const express = require("express");
const db = require("../db");
const { withOrderTotals } = require("../helpers");

module.exports = function clientsRouter(emitChange) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT c.*,
            COUNT(o.id)::int AS orders_count,
            COALESCE(SUM(o.games_cost + o.tables_cost + o.escort_cost + o.logistics_cost), 0)::int AS total_spent
         FROM clients c
         LEFT JOIN orders o ON o.client_id = c.id
         GROUP BY c.id
         ORDER BY c.created_at DESC
      `);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const { rows: clientRows } = await db.query("SELECT * FROM clients WHERE id = $1", [req.params.id]);
      const client = clientRows[0];
      if (!client) return res.status(404).json({ error: "Клієнта не знайдено" });

      const { rows: orderRows } = await db.query(
        "SELECT * FROM orders WHERE client_id = $1 ORDER BY event_date DESC",
        [req.params.id]
      );
      const { rows: interactions } = await db.query(
        "SELECT * FROM interactions WHERE client_id = $1 ORDER BY created_at DESC",
        [req.params.id]
      );
      res.json({ ...client, orders: orderRows.map(withOrderTotals), interactions });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    const { phone, name, source_channel, notes } = req.body;
    if (!phone || !name) return res.status(400).json({ error: "Телефон і ім'я обов'язкові" });
    try {
      const { rows } = await db.query(
        "INSERT INTO clients (phone, name, source_channel, notes) VALUES ($1, $2, $3, $4) RETURNING *",
        [phone, name, source_channel || null, notes || null]
      );
      const client = rows[0];
      emitChange("client:created", client);
      res.status(201).json(client);
    } catch (err) {
      if (err.code === "23505") return res.status(400).json({ error: "Клієнт з таким телефоном вже існує" });
      next(err);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM clients WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Клієнта не знайдено" });

      const { phone, name, source_channel, notes } = req.body;
      const { rows } = await db.query(
        "UPDATE clients SET phone = $1, name = $2, source_channel = $3, notes = $4 WHERE id = $5 RETURNING *",
        [
          phone ?? existing.phone,
          name ?? existing.name,
          source_channel ?? existing.source_channel,
          notes ?? existing.notes,
          req.params.id,
        ]
      );
      const client = rows[0];
      emitChange("client:updated", client);
      res.json(client);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
