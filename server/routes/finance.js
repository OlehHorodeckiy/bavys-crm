const express = require("express");
const db = require("../db");

// Every real payment ever recorded, one row per transaction — the label
// (Аванс/Доплата/Оплата) is derived per order from how many payments that
// order has and this one's position among them, never stored on the row
// itself, so old backfilled single payments read correctly as "Оплата"
// without touching their data.
module.exports = function financeRouter() {
  const router = express.Router();

  router.get("/payments", async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT p.id, p.date, p.amount, p.method, c.name AS client_name,
               COUNT(*) OVER (PARTITION BY p.order_id)::int AS payment_count,
               ROW_NUMBER() OVER (PARTITION BY p.order_id ORDER BY p.created_at, p.id)::int AS payment_rank
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        JOIN clients c ON c.id = o.client_id
        ORDER BY p.date ASC, p.created_at ASC
      `);
      const withLabel = rows.map((r) => {
        const label = r.payment_count === 1 ? "Оплата" : r.payment_rank === 1 ? "Аванс" : "Доплата";
        return { id: r.id, date: r.date, amount: r.amount, method: r.method, description: `${label} — ${r.client_name}` };
      });
      res.json(withLabel);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
