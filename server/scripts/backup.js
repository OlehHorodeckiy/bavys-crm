const fs = require("fs");
const path = require("path");
const db = require("../db");

// Keep in sync with server/db.js — FK-safe order doesn't actually matter
// for a plain SELECT dump, but restore.js reuses this same list for INSERTs
// where order does matter, so it lives here once.
const TABLES = ["clients", "staff", "transactions", "orders", "calculations", "interactions", "payments", "line_items"];

async function run() {
  const dump = { createdAt: new Date().toISOString(), tables: {} };
  let totalRows = 0;

  for (const table of TABLES) {
    const { rows } = await db.query(`SELECT * FROM "${table}" ORDER BY id`);
    dump.tables[table] = rows;
    totalRows += rows.length;
  }

  // An all-empty dump almost always means DATABASE_URL points at the wrong
  // database, not a genuinely empty CRM — refuse rather than "succeed" with
  // a backup that would be useless (and falsely reassuring) to restore from.
  if (totalRows === 0) {
    console.error("Бекап зупинено: усі таблиці порожні. Перевірте DATABASE_URL.");
    process.exit(1);
  }

  const dir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${dump.createdAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(dump, null, 2));

  console.log(`Бекап збережено: ${file}`);
  for (const table of TABLES) console.log(`  ${table}: ${dump.tables[table].length}`);

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
