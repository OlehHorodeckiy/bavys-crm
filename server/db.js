const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function columnExists(table, column) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows.length > 0;
}

// Brings an orders table created under the old schema (base_price,
// extra_services_fee, transport_fee, partner_discount, payment_status,
// 6-value status pipeline) up to the current one, without touching any
// real rows already in it. No-op on a freshly created table.
async function migrateOrdersTable() {
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS games_cost INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tables_cost INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS escort_cost INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS logistics_cost INTEGER NOT NULL DEFAULT 0`);

  if (await columnExists("orders", "base_price")) {
    await pool.query(`UPDATE orders SET games_cost = base_price WHERE base_price IS NOT NULL`);
    await pool.query(`ALTER TABLE orders DROP COLUMN base_price`);
  }
  if (await columnExists("orders", "transport_fee")) {
    await pool.query(`UPDATE orders SET logistics_cost = transport_fee WHERE transport_fee IS NOT NULL`);
    await pool.query(`ALTER TABLE orders DROP COLUMN transport_fee`);
  }
  if (await columnExists("orders", "extra_services_fee")) {
    // Old schema merged "tables" + "service" into one fee; keep the total
    // intact by folding it into escort_cost rather than guessing a split.
    await pool.query(`UPDATE orders SET escort_cost = escort_cost + extra_services_fee WHERE extra_services_fee IS NOT NULL`);
    await pool.query(`ALTER TABLE orders DROP COLUMN extra_services_fee`);
  }
  if (await columnExists("orders", "partner_discount")) {
    await pool.query(`ALTER TABLE orders DROP COLUMN partner_discount`);
  }
  if (await columnExists("orders", "payment_status")) {
    await pool.query(`ALTER TABLE orders DROP COLUMN payment_status`);
  }

  await pool.query(`UPDATE orders SET status = 'waiting_advance' WHERE status IN ('new', 'confirmed', 'advance_paid')`);
  await pool.query(`ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'waiting_advance'`);

  // Detail behind the aggregate cost fields, populated when an order is
  // built from a Підрахунок (calculator) — needed for future per-game stats.
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tables_count INTEGER`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS escort_hours INTEGER`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS escort_people INTEGER`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS calculation_id INTEGER`);
}

// One-time backfill: turns the old single advance_amount number into a real
// payment record, so orders created before the payments ledger existed still
// count correctly toward the balance and the card/cash split. No-op once run
// (skips any order that already has a payment row).
async function backfillPayments() {
  const { rows: candidates } = await pool.query(`
    SELECT o.id, o.status, o.advance_amount,
           (o.games_cost + o.tables_cost + o.escort_cost + o.logistics_cost) AS total_amount
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE p.id IS NULL AND (o.advance_amount > 0 OR o.status IN ('paid', 'completed'))
    GROUP BY o.id
  `);
  for (const o of candidates) {
    const fullyPaid = o.status === "paid" || o.status === "completed";
    const amount = fullyPaid ? o.total_amount : o.advance_amount;
    if (amount <= 0) continue;
    const kind = fullyPaid ? "final" : "advance";
    await pool.query(
      `INSERT INTO payments (order_id, amount, method, kind, date)
       VALUES ($1, $2, 'cash', $3, CURRENT_DATE::text)`,
      [o.id, amount, kind]
    );
  }
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      source_channel TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      position TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      event_type TEXT NOT NULL DEFAULT 'Дитяче свято',
      venue TEXT,
      status TEXT NOT NULL DEFAULT 'waiting_advance',
      event_date TEXT,
      advance_date TEXT,
      games_cost INTEGER NOT NULL DEFAULT 0,
      tables_cost INTEGER NOT NULL DEFAULT 0,
      escort_cost INTEGER NOT NULL DEFAULT 0,
      logistics_cost INTEGER NOT NULL DEFAULT 0,
      advance_amount INTEGER NOT NULL DEFAULT 0,
      comment TEXT,
      assigned_staff_id INTEGER REFERENCES staff(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT
    );

    -- Manual P&L / cash-flow ledger. Order income is NOT duplicated here —
    -- it's read live from orders (see routes/pl.js) so it can never drift
    -- out of sync with an edited or deleted order.
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      type TEXT NOT NULL DEFAULT 'expense',
      flow TEXT NOT NULL DEFAULT 'out',
      amount INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT,
      comment TEXT,
      affects_pl BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- A quick client-facing price quote ("Підрахунок") built by clicking
    -- games. Not an order yet — becomes one only via /convert.
    CREATE TABLE IF NOT EXISTS calculations (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      status TEXT NOT NULL DEFAULT 'active',
      tables_count INTEGER NOT NULL DEFAULT 0,
      escort_hours INTEGER NOT NULL DEFAULT 0,
      escort_people INTEGER NOT NULL DEFAULT 0,
      delivery_amount INTEGER NOT NULL DEFAULT 0,
      converted_order_id INTEGER REFERENCES orders(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Every real payment received against an order, kept as its own
    -- append-only row (advance and final payments never overwrite each
    -- other) — this is the single source of truth for money collected.
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      kind TEXT NOT NULL DEFAULT 'advance',
      date TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Individual games selected on a calculation or carried onto an order,
    -- kept as separate rows (not folded into one total) so popularity and
    -- per-game revenue can be reported later without re-deriving it.
    CREATE TABLE IF NOT EXISTS line_items (
      id SERIAL PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      game_name TEXT NOT NULL,
      is_package BOOLEAN NOT NULL DEFAULT false,
      price INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await migrateOrdersTable();
  await backfillPayments();
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  init,
};
