const express = require("express");
const db = require("../db");
const { withOrderTotals, STATUS_PIPELINE } = require("../helpers");

const ORDER_FIELDS = [
  "client_id",
  "event_type",
  "venue",
  "status",
  "event_date",
  "advance_date",
  "base_price",
  "advance_amount",
  "extra_services_fee",
  "transport_fee",
  "partner_discount",
  "payment_status",
  "comment",
  "assigned_staff_id",
];

const FIELD_DEFAULTS = {
  event_type: "Дитяче свято",
  status: "new",
  base_price: 0,
  advance_amount: 0,
  extra_services_fee: 0,
  transport_fee: 0,
  partner_discount: 0,
  payment_status: "waiting",
};

async function logInteraction(clientId, orderId, type, text) {
  await db.query(
    "INSERT INTO interactions (client_id, order_id, type, text, created_by) VALUES ($1, $2, $3, $4, $5)",
    [clientId, orderId, type, text, "system"]
  );
}

module.exports = function ordersRouter(emitChange) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT o.*, c.name AS client_name, c.phone AS client_phone, s.name AS staff_name
         FROM orders o
         JOIN clients c ON c.id = o.client_id
         LEFT JOIN staff s ON s.id = o.assigned_staff_id
         ORDER BY o.event_date ASC
      `);
      res.json(rows.map(withOrderTotals));
    } catch (err) {
      next(err);
    }
  });

  router.get("/statuses", (req, res) => res.json(STATUS_PIPELINE));

  router.post("/", async (req, res, next) => {
    const body = req.body;
    if (!body.client_id) return res.status(400).json({ error: "client_id обов'язковий" });
    try {
      const values = ORDER_FIELDS.map((f) => body[f] ?? FIELD_DEFAULTS[f] ?? null);
      const placeholders = ORDER_FIELDS.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await db.query(
        `INSERT INTO orders (${ORDER_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      const order = rows[0];

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

  return router;
};
