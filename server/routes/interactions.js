const express = require("express");
const db = require("../db");

module.exports = function interactionsRouter(emitChange) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT i.*, c.name AS client_name
         FROM interactions i
         JOIN clients c ON c.id = i.client_id
         ORDER BY i.created_at DESC
         LIMIT 50
      `);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    const { client_id, order_id, type, text, created_by } = req.body;
    if (!client_id || !type || !text) {
      return res.status(400).json({ error: "client_id, type, text обов'язкові" });
    }
    try {
      const { rows } = await db.query(
        "INSERT INTO interactions (client_id, order_id, type, text, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [client_id, order_id || null, type, text, created_by || "менеджер"]
      );
      const interaction = rows[0];
      emitChange("interaction:created", interaction);
      res.status(201).json(interaction);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
