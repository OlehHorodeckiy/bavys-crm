const express = require("express");
const db = require("../db");
const { withOrderTotals, STATUS_PIPELINE, PAYMENT_METHODS } = require("../helpers");
const { ORDER_GAMES } = require("../pricing");
const { loadCalculation, getLineItems, replaceLineItems } = require("./calculations");
const { syncCalendarForOrder } = require("../googleCalendar");

function sanitizeGames(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input)].filter((g) => typeof g === "string" && ORDER_GAMES.includes(g));
}

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

  // Per-game popularity — how many orders included each game, including
  // games that have never been ordered (zero-filled), most popular first.
  router.get("/games/stats", async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT game_name, COUNT(DISTINCT owner_id)::int AS orders_count
         FROM line_items WHERE owner_type = 'order' GROUP BY game_name`
      );
      const counts = Object.fromEntries(rows.map((r) => [r.game_name, r.orders_count]));
      const stats = ORDER_GAMES.map((game_name) => ({ game_name, orders_count: counts[game_name] || 0 })).sort(
        (a, b) => b.orders_count - a.orders_count || a.game_name.localeCompare(b.game_name, "uk")
      );
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

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

  // Replaces the order's game composition wholesale — analytics-only,
  // never touches money (same emitChange convention as payments: no
  // `orders` column changes, but it's still an order-level update).
  router.put("/:id/games", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Замовлення не знайдено" });

      const items = sanitizeGames(req.body.games).map((name) => ({ game_name: name, is_package: false, price: 0 }));
      await replaceLineItems("order", existing.id, items);

      const { rows: collectedRows } = await db.query(
        "SELECT COALESCE(SUM(amount),0)::int AS collected_amount FROM payments WHERE order_id = $1",
        [existing.id]
      );
      const full = withOrderTotals({ ...existing, collected_amount: collectedRows[0].collected_amount });
      emitChange("order:updated", full);
      res.json({ ...full, items });
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

      // An advance can be recorded in the same request that creates the
      // order — capped at the order's own total so it can never overshoot.
      // It only credits the balance; the status is whatever the caller
      // chose (or the default) and is never inferred from this payment —
      // status and money stay fully independent, same as everywhere else.
      const totalAmount =
        (Number(body.games_cost) || 0) +
        (Number(body.tables_cost) || 0) +
        (Number(body.escort_cost) || 0) +
        (Number(body.logistics_cost) || 0);
      const advanceAmount = Math.min(Math.max(Number(body.advance_amount) || 0, 0), totalAmount);
      const advanceMethod = ["card", "cash"].includes(body.payment_method) ? body.payment_method : "cash";

      const values = ORDER_FIELDS.map((f) => body[f] ?? FIELD_DEFAULTS[f] ?? null);
      const placeholders = ORDER_FIELDS.map((_, i) => `$${i + 1}`).join(", ");
      const { rows } = await db.query(
        `INSERT INTO orders (${ORDER_FIELDS.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      const order = rows[0];

      if (advanceAmount > 0) {
        await db.query(
          "INSERT INTO payments (order_id, amount, method, kind, date) VALUES ($1,$2,$3,'advance', CURRENT_DATE::text)",
          [order.id, advanceAmount, advanceMethod]
        );
      }

      if (calc) {
        const calcItems = await getLineItems("calculation", calc.id);
        await replaceLineItems("order", order.id, calcItems);
        await db.query("UPDATE calculations SET status = 'converted', converted_order_id = $1 WHERE id = $2", [order.id, calc.id]);
      } else if (Array.isArray(body.games) && body.games.length > 0) {
        // No calculation — games chosen manually, recorded unpriced (this
        // block is analytics-only and never affects the order's finances).
        const items = sanitizeGames(body.games).map((name) => ({ game_name: name, is_package: false, price: 0 }));
        await replaceLineItems("order", order.id, items);
      }

      await logInteraction(body.client_id, order.id, "status_change", "Замовлення створено");

      // Best-effort — never blocks the order from saving (see googleCalendar.js).
      const { rows: clientRows } = await db.query("SELECT name FROM clients WHERE id = $1", [order.client_id]);
      const newEventId = await syncCalendarForOrder(order, clientRows[0]?.name || "");
      if (newEventId !== order.calendar_event_id) {
        await db.query("UPDATE orders SET calendar_event_id = $1 WHERE id = $2", [newEventId, order.id]);
        order.calendar_event_id = newEventId;
      }

      const full = withOrderTotals({ ...order, collected_amount: advanceAmount });
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

      // Best-effort — never blocks the order from saving (see googleCalendar.js).
      const { rows: clientRows } = await db.query("SELECT name FROM clients WHERE id = $1", [order.client_id]);
      const newEventId = await syncCalendarForOrder(order, clientRows[0]?.name || "");
      if (newEventId !== order.calendar_event_id) {
        await db.query("UPDATE orders SET calendar_event_id = $1 WHERE id = $2", [newEventId, order.id]);
        order.calendar_event_id = newEventId;
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

  async function currentTotals(order) {
    const totalAmount = order.games_cost + order.tables_cost + order.escort_cost + order.logistics_cost;
    const { rows } = await db.query(
      "SELECT COALESCE(SUM(amount),0)::int AS collected FROM payments WHERE order_id = $1",
      [order.id]
    );
    return { totalAmount, collected: rows[0].collected };
  }

  // Payments only ever change collected_amount/balance — never the order's
  // status. Status is a purely organizational field the user moves by hand
  // (see PUT /:id and the kanban); the two are intentionally decoupled.
  router.post("/:id/payments", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Замовлення не знайдено" });

      const { amount, method } = req.body;
      const amountNum = Math.abs(Number(amount)) || 0;
      if (amountNum <= 0) return res.status(400).json({ error: "Сума платежу обов'язкова" });
      if (!["card", "cash"].includes(method)) return res.status(400).json({ error: "Спосіб оплати: card або cash" });

      const { totalAmount, collected } = await currentTotals(existing);
      const remaining = Math.max(totalAmount - collected, 0);
      if (amountNum > remaining) {
        return res.status(400).json({ error: `Сума перевищує залишок до оплати (${remaining} грн)` });
      }

      const kind = collected === 0 ? "advance" : "final";
      await db.query(
        "INSERT INTO payments (order_id, amount, method, kind, date) VALUES ($1,$2,$3,$4, CURRENT_DATE::text)",
        [existing.id, amountNum, method, kind]
      );

      const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
      await logInteraction(existing.client_id, existing.id, "status_change", `Платіж отримано: ${amountNum} грн (${methodLabel})`);

      const full = withOrderTotals({ ...existing, collected_amount: collected + amountNum });
      emitChange("order:updated", full);
      res.status(201).json(full);
    } catch (err) {
      next(err);
    }
  });

  // Edit an existing payment's amount/method — the order's collected total,
  // remaining balance and card/cash split all recompute from this. Status
  // is untouched, same as every other payment mutation.
  router.put("/:id/payments/:paymentId", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Замовлення не знайдено" });

      const { rows: paymentRows } = await db.query("SELECT * FROM payments WHERE id = $1 AND order_id = $2", [
        req.params.paymentId,
        req.params.id,
      ]);
      const payment = paymentRows[0];
      if (!payment) return res.status(404).json({ error: "Платіж не знайдено" });

      const { amount, method } = req.body;
      const amountNum = Math.abs(Number(amount)) || 0;
      if (amountNum <= 0) return res.status(400).json({ error: "Сума платежу обов'язкова" });
      if (!["card", "cash"].includes(method)) return res.status(400).json({ error: "Спосіб оплати: card або cash" });

      const { totalAmount, collected } = await currentTotals(existing);
      const collectedExcluding = collected - payment.amount;
      const ceiling = Math.max(totalAmount - collectedExcluding, 0);
      if (amountNum > ceiling) {
        return res.status(400).json({ error: `Сума не може перевищувати ${ceiling} грн` });
      }

      await db.query("UPDATE payments SET amount = $1, method = $2 WHERE id = $3", [amountNum, method, payment.id]);

      const full = withOrderTotals({ ...existing, collected_amount: collectedExcluding + amountNum });
      emitChange("order:updated", full);
      res.json(full);
    } catch (err) {
      next(err);
    }
  });

  // Delete a payment — money it represented is removed from the balance.
  // Status is untouched, same as every other payment mutation.
  router.delete("/:id/payments/:paymentId", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Замовлення не знайдено" });

      const { rows: paymentRows } = await db.query("SELECT * FROM payments WHERE id = $1 AND order_id = $2", [
        req.params.paymentId,
        req.params.id,
      ]);
      const payment = paymentRows[0];
      if (!payment) return res.status(404).json({ error: "Платіж не знайдено" });

      await db.query("DELETE FROM payments WHERE id = $1", [payment.id]);

      const { collected } = await currentTotals(existing);
      const full = withOrderTotals({ ...existing, collected_amount: collected });
      emitChange("order:updated", full);
      res.json(full);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Замовлення не знайдено" });

      // Best-effort — a calendar hiccup must never block deleting the order.
      // Forcing event_date to null makes syncCalendarForOrder take its
      // "shouldn't have an event" branch, i.e. delete it, regardless of status.
      if (existing.calendar_event_id) {
        await syncCalendarForOrder({ ...existing, event_date: null }, "");
      }

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
