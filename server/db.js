const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
      status TEXT NOT NULL DEFAULT 'new',
      event_date TEXT,
      advance_date TEXT,
      base_price INTEGER NOT NULL DEFAULT 0,
      advance_amount INTEGER NOT NULL DEFAULT 0,
      extra_services_fee INTEGER NOT NULL DEFAULT 0,
      transport_fee INTEGER NOT NULL DEFAULT 0,
      partner_discount INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'waiting',
      comment TEXT,
      assigned_staff_id INTEGER REFERENCES staff(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      order_id INTEGER REFERENCES orders(id),
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT
    );
  `);
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  init,
};
