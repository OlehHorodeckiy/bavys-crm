const express = require("express");
const db = require("../db");

module.exports = function staffRouter(emitChange) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT s.*,
            COUNT(o.id)::int AS orders_count,
            SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END)::int AS paid_orders_count,
            COALESCE(SUM(o.games_cost + o.tables_cost + o.escort_cost + o.logistics_cost), 0)::int AS total_revenue
         FROM staff s
         LEFT JOIN orders o ON o.assigned_staff_id = s.id
         GROUP BY s.id
         ORDER BY s.name
      `);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    const { name, position } = req.body;
    if (!name) return res.status(400).json({ error: "Ім'я обов'язкове" });
    try {
      const { rows } = await db.query(
        "INSERT INTO staff (name, position) VALUES ($1, $2) RETURNING *",
        [name, position || null]
      );
      const member = rows[0];
      emitChange("staff:created", member);
      res.status(201).json(member);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
