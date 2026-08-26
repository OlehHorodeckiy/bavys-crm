const express = require("express");
const db = require("../db");

const ORDER_REVENUE = "(o.games_cost + o.tables_cost + o.escort_cost + o.logistics_cost)";
// Money actually collected for an order: the full total once it's marked
// "Оплачено", otherwise whatever advance/partial payment is on record.
const ORDER_COLLECTED = `(CASE WHEN o.status = 'paid' THEN ${ORDER_REVENUE} ELSE o.advance_amount END)`;

function dateFilter(column, from, to, params) {
  const parts = [];
  if (from) { params.push(from); parts.push(`${column} >= $${params.length}`); }
  if (to) { params.push(to); parts.push(`${column} <= $${params.length}`); }
  return parts;
}

module.exports = function plRouter() {
  const router = express.Router();

  router.get("/summary", async (req, res, next) => {
    try {
      const { from, to } = req.query;

      // Accrual revenue: full value of every order whose event falls in the period.
      const orderParams = [];
      const orderConds = ["o.status != 'cancelled'", ...dateFilter("o.event_date", from, to, orderParams)];
      const { rows: orderRevRows } = await db.query(
        `SELECT COALESCE(SUM(${ORDER_REVENUE}), 0)::int AS revenue,
                COALESCE(SUM(GREATEST(${ORDER_REVENUE} - ${ORDER_COLLECTED}, 0)), 0)::int AS outstanding,
                COUNT(*)::int AS orders_count
         FROM orders o WHERE ${orderConds.join(" AND ")}`,
        orderParams
      );

      // Manual ledger entries that count toward P&L (personal/capital never do).
      const txParams = [];
      const txConds = ["affects_pl = true", ...dateFilter("date", from, to, txParams)];
      const { rows: txRows } = await db.query(
        `SELECT
            COALESCE(SUM(amount) FILTER (WHERE flow = 'in'), 0)::int AS income,
            COALESCE(SUM(amount) FILTER (WHERE flow = 'out'), 0)::int AS expenses
         FROM transactions WHERE ${txConds.join(" AND ")}`,
        txParams
      );

      // Owner capital contributed in the period — moves the balance, not the P&L.
      const capitalParams = [];
      const capitalConds = ["type = 'capital'", ...dateFilter("date", from, to, capitalParams)];
      const { rows: capitalRows } = await db.query(
        `SELECT COALESCE(SUM(amount), 0)::int AS contributed FROM transactions WHERE ${capitalConds.join(" AND ")}`,
        capitalParams
      );

      // Balance is a point-in-time snapshot, not scoped to the period:
      // all cash actually collected from orders + all manual cash movements.
      const { rows: balanceOrderRows } = await db.query(
        `SELECT COALESCE(SUM(${ORDER_COLLECTED}), 0)::int AS collected FROM orders o WHERE o.status != 'cancelled'`
      );
      const { rows: balanceTxRows } = await db.query(
        `SELECT COALESCE(SUM(CASE WHEN flow = 'in' THEN amount ELSE -amount END), 0)::int AS net FROM transactions`
      );

      const revenue = orderRevRows[0].revenue + txRows[0].income;
      const expenses = txRows[0].expenses;

      res.json({
        revenue,
        expenses,
        net_profit: revenue - expenses,
        balance: balanceOrderRows[0].collected + balanceTxRows[0].net,
        capital_contributed: capitalRows[0].contributed,
        outstanding: orderRevRows[0].outstanding,
        orders_count: orderRevRows[0].orders_count,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/revenue-breakdown", async (req, res, next) => {
    try {
      const { from, to } = req.query;
      const params = [];
      const conds = ["status != 'cancelled'", ...dateFilter("event_date", from, to, params)];
      const { rows } = await db.query(
        `SELECT COALESCE(SUM(games_cost),0)::int AS games,
                COALESCE(SUM(tables_cost),0)::int AS tables,
                COALESCE(SUM(escort_cost),0)::int AS escort,
                COALESCE(SUM(logistics_cost),0)::int AS logistics
         FROM orders WHERE ${conds.join(" AND ")}`,
        params
      );
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.get("/expense-breakdown", async (req, res, next) => {
    try {
      const { from, to } = req.query;
      const params = [];
      const conds = ["affects_pl = true", "flow = 'out'", ...dateFilter("date", from, to, params)];
      const { rows } = await db.query(
        `SELECT COALESCE(category, 'Інше') AS category, COALESCE(SUM(amount),0)::int AS amount
         FROM transactions WHERE ${conds.join(" AND ")}
         GROUP BY category ORDER BY amount DESC`,
        params
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.get("/monthly", async (req, res, next) => {
    try {
      const { from, to } = req.query;

      const orderParams = [];
      const orderConds = ["status != 'cancelled'", "event_date IS NOT NULL", ...dateFilter("event_date", from, to, orderParams)];
      const { rows: revRows } = await db.query(
        `SELECT to_char(event_date::date, 'YYYY-MM') AS month,
                COALESCE(SUM(games_cost + tables_cost + escort_cost + logistics_cost), 0)::int AS revenue
         FROM orders WHERE ${orderConds.join(" AND ")}
         GROUP BY month`,
        orderParams
      );

      const txParams = [];
      const txConds = ["affects_pl = true", ...dateFilter("date", from, to, txParams)];
      const { rows: txRows } = await db.query(
        `SELECT to_char(date::date, 'YYYY-MM') AS month,
                COALESCE(SUM(amount) FILTER (WHERE flow = 'in'), 0)::int AS income,
                COALESCE(SUM(amount) FILTER (WHERE flow = 'out'), 0)::int AS expenses
         FROM transactions WHERE ${txConds.join(" AND ")}
         GROUP BY month`,
        txParams
      );

      const byMonth = {};
      const ensure = (m) => (byMonth[m] ||= { month: m, revenue: 0, expenses: 0 });
      for (const r of revRows) ensure(r.month).revenue += r.revenue;
      for (const r of txRows) {
        ensure(r.month).revenue += r.income;
        ensure(r.month).expenses += r.expenses;
      }
      const result = Object.values(byMonth)
        .map((m) => ({ ...m, profit: m.revenue - m.expenses }))
        .sort((a, b) => a.month.localeCompare(b.month));
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
