const express = require("express");
const db = require("../db");
const { withOrderTotals, STATUS_PIPELINE } = require("../helpers");
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
  "advance_amount",
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
  advance_amount: 0,
};

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
        SELECT o.*, c.name AS client_name, c.phone AS client_phone, s.name AS staff_name
         FROM orders o
         JOIN clients c ON c.id = o.client_id
         LEFT JOIN staff s ON s.id = o.assigned_staff_id
         ${ORDER_BY_EVENT_DATE}
      `);
      res.json(rows.map(withOrderTotals));
    } catch (err) {
      next(err);
    }
  });

  router.get("/statuses", (req, res) => res.json(STATUS_PIPELINE));

  router.get("/:id/items", async (req, res, next) => {
    try {
      const items = await getLineItems("order", req.params.id);
      res.json(items);
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

      emitChange("order:created", withOrderTotals(order));
      res.status(201).json(withOrderTotals(order));
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

      emitChange("order:updated", withOrderTotals(order));
      res.json(withOrderTotals(order));
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
      await db.query("DELETE FROM orders WHERE id = $1", [req.params.id]);

      emitChange("order:deleted", { id: Number(req.params.id) });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
};
