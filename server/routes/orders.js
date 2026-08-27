const express = require("express");
const db = require("../db");
const { withOrderTotals, STATUS_PIPELINE, PAYMENT_STATUSES, PAYMENT_METHODS } = require("../helpers");
const { loadCalculation, getLineItems, replaceLineItems } = require("./calculations");

const ORDER_FIELDS = [
  "client_id",
  "event_type",
  "venue",
  "status",
  "event_date",
  "advance_date",
  "games_cost",
  "tables_cost",
  "escort_cost",
  "logistics_cost",
  "comment",
  "assigned_staff_id",
  "tables_count",
  "escort_hours",
  "escort_people",
  "calculation_id",
];

const FIELD_DEFAULTS = {
  event_type: "Дитяче свято",
  status: "waiting_advance",
  games_cost: 0,
  tables_cost: 0,
  escort_cost: 0,
  logistics_cost: 0,
};

// Every SELECT that needs remaining_balance/collected_amount joins this so
// "money in" always comes from the payments ledger, never a stale column.
const COLLECTED_JOIN = `LEFT JOIN (
  SELECT order_id, COALESCE(SUM(amount), 0)::int AS collected_amount
  FROM payments GROUP BY order_id
) pay ON pay.order_id = o.id`;

async function logInteraction(clientId, orderId, type, text) {
  await db.query(
    "INSERT INTO interactions (client_id, order_id, type, text, created_by) VALUES ($1, $2, $3, $4, $5)",
    [clientId, orderId, type, text, "system"]
  );
}

// Future events soonest-first, then past events most-recent-first.
const ORDER_BY_EVENT_DATE = `
  ORDER BY
    CASE WHEN o.event_date::date >= CURRENT_DATE THEN 0 ELSE 1 END,
    CASE WHEN o.event_date::date >= CURRENT_DATE THEN o.event_date END ASC,
    CASE WHEN o.event_date::date < CURRENT_DATE THEN o.event_date END DESC
`;

module.exports = function ordersRouter(emitChange) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT o.*, c.name AS client_name, c.phone AS client_phone, s.name AS staff_name,
               COALESCE(pay.collected_amount, 0)::int AS collected_amount
         FROM orders o
         JOIN clients c ON c.id = o.client_id
         LEFT JOIN staff s ON s.id = o.assigned_staff_id
         ${COLLECTED_JOIN}
         ${ORDER_BY_EVENT_DATE}
      `);
      res.json(rows.map(withOrderTotals));
    } catch (err) {
      next(err);
    }
  });

  router.get("/statuses", (req, res) => res.json(STATUS_PIPELINE));
  router.get("/payment-methods", (req, res) => res.json(PAYMENT_METHODS));

  router.get("/:id", async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT o.*, c.name AS client_name, c.phone AS client_phone,
                COALESCE(pay.collected_amount, 0)::int AS collected_amount
         FROM orders o JOIN clients c ON c.id = o.client_id
         ${COLLECTED_JOIN}
         WHERE o.id = $1`,
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Замовлення не знайдено" });
      res.json(withOrderTotals(rows[0]));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id/items", async (req, res, next) => {
    try {
      const items = await getLineItems("order", req.params.id);
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id/payments", async (req, res, next) => {
    try {
      const { rows } = await db.query("SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at", [req.params.id]);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    const body = { ...req.body };
    try {
      let calc = null;
      if (body.calculation_id) {
        calc = await loadCalculation(body.calculation_id);
        if (calc) {
          body.client_id ??= calc.client_id;
          body.games_cost ??= calc.games_total;
          body.tables_cost ??= calc.tables_total;
          body.escort_cost ??= calc.escort_total;
          body.logistics_cost ??= calc.delivery_amount;
          body.tables_count ??= calc.tables_count;
          body.escort_hours ??= calc.escort_hours;
          body.escort_people ??= calc.escort_people;
        }
      }
      if (!body.client_id) return res.status(400).json({ error: "client_id обов'язковий" });

      const values = ORDER_FIELDS.map((f) => body[f] ?? FIELD_DEFAULTS[f] ?? null);
      const placeholders = ORDER_FIELDS.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await db.query(
        `INSERT INTO orders (${ORDER_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      const order = rows[0];

      if (calc) {
        const calcItems = await getLineItems("calculation", calc.id);
        await replaceLineItems("order", order.id, calcItems);
        await db.query("UPDATE calculations SET status = 'converted', converted_order_id = $1 WHERE id = $2", [order.id, calc.id]);
      }

      await logInteraction(body.client_id, order.id, "status_change", "Замовлення створено");

      const full = withOrderTotals({ ...order, collected_amount: 0 });
      emitChange("order:created", full);
      res.status(201).json(full);
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Замовлення не знайдено" });

      const body = req.body;
      if (body.status && body.status !== existing.status && PAYMENT_STATUSES[body.status]) {
        return res.status(400).json({
          error: "Цей статус встановлюється лише через внесення оплати (POST /orders/:id/payments)",
        });
      }

      const merged = { ...existing, ...body };
      const values = ORDER_FIELDS.map((f) => merged[f] ?? null);
      const setClause = ORDER_FIELDS.map((f, i) => `${f} = $${i + 1}`).join(", ");
      const { rows } = await db.query(
        `UPDATE orders SET ${setClause}, updated_at = NOW() WHERE id = $${ORDER_FIELDS.length + 1} RETURNING *`,
        [...values, req.params.id]
      );
      const order = rows[0];

      if (body.status && body.status !== existing.status) {
        const label = STATUS_PIPELINE.find((s) => s.value === body.status)?.label || body.status;
        await logInteraction(existing.client_id, existing.id, "status_change", `Статус змінено на «${label}»`);
      }

      const { rows: collectedRows } = await db.query(
        "SELECT COALESCE(SUM(amount),0)::int AS collected_amount FROM payments WHERE order_id = $1",
        [req.params.id]
      );
      const full = withOrderTotals({ ...order, collected_amount: collectedRows[0].collected_amount });
      emitChange("order:updated", full);
      res.json(full);
    } catch (err) {
      next(err);
    }
  });

  // The only way an order can move to "Оплачений аванс" or "Оплачено" —
  // records a standalone payment (advance and final payments never overwrite
  // each other) and flips the status in the same request.
  router.post("/:id/payments", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Замовлення не знайдено" });

      const { amount, method, kind } = req.body;
      const amountNum = Math.abs(Number(amount)) || 0;
      if (amountNum <= 0) return res.status(400).json({ error: "Сума платежу обов'язкова" });
      if (!["card", "cash"].includes(method)) return res.status(400).json({ error: "Спосіб оплати: card або cash" });
      const paymentKind = kind === "final" ? "final" : "advance";
      const newStatus = paymentKind === "final" ? "paid" : "advance_paid";

      await db.query(
        "INSERT INTO payments (order_id, amount, method, kind, date) VALUES ($1,$2,$3,$4, CURRENT_DATE::text)",
        [existing.id, amountNum, method, paymentKind]
      );
      await db.query("UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2", [newStatus, existing.id]);

      const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
      const kindLabel = paymentKind === "final" ? "Доплату" : "Аванс";
      await logInteraction(
        existing.client_id,
        existing.id,
        "status_change",
        `${kindLabel} отримано: ${amountNum} грн (${methodLabel})`
      );

      const { rows: orderRows } = await db.query("SELECT * FROM orders WHERE id = $1", [existing.id]);
      const { rows: collectedRows } = await db.query(
        "SELECT COALESCE(SUM(amount),0)::int AS collected_amount FROM payments WHERE order_id = $1",
        [existing.id]
      );
      const full = withOrderTotals({ ...orderRows[0], collected_amount: collectedRows[0].collected_amount });
      emitChange("order:updated", full);
      res.status(201).json(full);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Замовлення не знайдено" });

      await db.query("UPDATE interactions SET order_id = NULL WHERE order_id = $1", [req.params.id]);
      await db.query(
        "UPDATE calculations SET converted_order_id = NULL, status = 'active' WHERE converted_order_id = $1",
        [req.params.id]
      );
      await db.query("DELETE FROM line_items WHERE owner_type = 'order' AND owner_id = $1", [req.params.id]);
      // payments cascade automatically (ON DELETE CASCADE)
      await db.query("DELETE FROM orders WHERE id = $1", [req.params.id]);

      emitChange("order:deleted", { id: Number(req.params.id) });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
};
