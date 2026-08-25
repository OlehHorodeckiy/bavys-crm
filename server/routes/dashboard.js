const express = require("express");
const db = require("../db");

function revenueExpr(alias = "o") {
  return `(${alias}.games_cost + ${alias}.tables_cost + ${alias}.escort_cost + ${alias}.logistics_cost)`;
}

module.exports = function dashboardRouter() {
  const router = express.Router();

  router.get("/summary", async (req, res, next) => {
    try {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const { rows: revenueRows } = await db.query(
        `SELECT COALESCE(SUM(${revenueExpr()}), 0)::int AS revenue, COUNT(*)::int AS count
         FROM orders o WHERE event_date >= $1 AND status != 'cancelled'`,
        [monthStart]
      );
      const monthRevenue = revenueRows[0];
      const avgCheck = monthRevenue.count > 0 ? monthRevenue.revenue / monthRevenue.count : 0;

      const { rows: upcoming } = await db.query(`
        SELECT o.id, o.event_date, o.venue, o.event_type, c.name AS client_name
         FROM orders o JOIN clients c ON c.id = o.client_id
         WHERE o.event_date::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)
           AND o.status != 'cancelled'
         ORDER BY o.event_date ASC
      `);

      const { rows: newClientsRows } = await db.query(
        "SELECT COUNT(*)::int AS count FROM clients WHERE created_at >= date_trunc('month', CURRENT_DATE)"
      );
      const { rows: totalClientsRows } = await db.query("SELECT COUNT(*)::int AS count FROM clients");
      const { rows: totalOrdersRows } = await db.query("SELECT COUNT(*)::int AS count FROM orders");

      res.json({
        month_revenue: monthRevenue.revenue,
        month_orders_count: monthRevenue.count,
        avg_check: avgCheck,
        upcoming_events: upcoming,
        new_clients_this_month: newClientsRows[0].count,
        total_clients: totalClientsRows[0].count,
        total_orders: totalOrdersRows[0].count,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/revenue-by-month", async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT to_char(event_date::date, 'YYYY-MM') AS month,
                COALESCE(SUM(${revenueExpr()}), 0)::int AS revenue,
                COUNT(*)::int AS orders_count
         FROM orders o
         WHERE event_date IS NOT NULL AND status != 'cancelled'
         GROUP BY month
         ORDER BY month ASC
      `);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.get("/orders-by-status", async (req, res, next) => {
    try {
      const { rows } = await db.query("SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status");
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.get("/channels", async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT COALESCE(source_channel, 'Не вказано') AS channel, COUNT(*)::int AS count
         FROM clients GROUP BY channel ORDER BY count DESC
      `);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
