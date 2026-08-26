const express = require("express");
const db = require("../db");
const { TRANSACTION_TYPES, EXPENSE_CATEGORIES } = require("../helpers");

const FIELDS = ["date", "description", "category", "type", "flow", "amount", "payment_method", "comment", "affects_pl"];

// income/capital -> in, expense/personal -> out, other -> whatever the client picked
function resolveFlow(type, flow) {
  if (type === "income" || type === "capital") return "in";
  if (type === "expense" || type === "personal") return "out";
  return flow === "in" ? "in" : "out";
}

// Personal spending and owner capital contributions move the balance but
// must never count as business income/expense in the P&L math.
function resolveAffectsPl(type, affectsPl) {
  if (type === "personal" || type === "capital") return false;
  return affectsPl !== false;
}

module.exports = function transactionsRouter(emitChange) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const { from, to } = req.query;
      const conditions = [];
      const params = [];
      if (from) { params.push(from); conditions.push(`date >= $${params.length}`); }
      if (to) { params.push(to); conditions.push(`date <= $${params.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const { rows } = await db.query(
        `SELECT * FROM transactions ${where} ORDER BY date DESC, id DESC`,
        params
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.get("/meta", (req, res) => res.json({ types: TRANSACTION_TYPES, categories: EXPENSE_CATEGORIES }));

  router.post("/", async (req, res, next) => {
    const body = req.body;
    const description = body.description || (body.type === "capital" ? "Власні кошти" : "");
    if (!description || !body.date || !body.amount) {
      return res.status(400).json({ error: "date, description, amount обов'язкові" });
    }
    try {
      const flow = resolveFlow(body.type, body.flow);
      const affectsPl = resolveAffectsPl(body.type, body.affects_pl);
      const values = [
        body.date,
        description,
        body.category || null,
        body.type || "expense",
        flow,
        Math.abs(Number(body.amount)) || 0,
        body.payment_method || null,
        body.comment || null,
        affectsPl,
      ];
      const { rows } = await db.query(
        `INSERT INTO transactions (${FIELDS.join(", ")}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        values
      );
      emitChange("transaction:created", rows[0]);
      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM transactions WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Операцію не знайдено" });

      const merged = { ...existing, ...req.body };
      const flow = resolveFlow(merged.type, merged.flow);
      const affectsPl = resolveAffectsPl(merged.type, merged.affects_pl);
      const values = [
        merged.date,
        merged.description,
        merged.category || null,
        merged.type,
        flow,
        Math.abs(Number(merged.amount)) || 0,
        merged.payment_method || null,
        merged.comment || null,
        affectsPl,
      ];
      const { rows } = await db.query(
        `UPDATE transactions SET ${FIELDS.map((f, i) => `${f} = $${i + 1}`).join(", ")} WHERE id = $${FIELDS.length + 1} RETURNING *`,
        [...values, req.params.id]
      );
      emitChange("transaction:updated", rows[0]);
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const { rows } = await db.query("DELETE FROM transactions WHERE id = $1 RETURNING id", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Операцію не знайдено" });
      emitChange("transaction:deleted", { id: Number(req.params.id) });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
};
