const fs = require("fs");
const readline = require("readline");
const db = require("../db");

const TABLES = ["clients", "staff", "transactions", "orders", "calculations", "interactions", "payments", "line_items"];

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

async function run() {
  const file = process.argv[2];
  if (!file) {
    console.error("Використання: npm run restore -- шлях/до/дампу.json");
    process.exit(1);
  }

  const dump = JSON.parse(fs.readFileSync(file, "utf8"));

  console.log(`Дамп від ${dump.createdAt}:`);
  for (const table of TABLES) console.log(`  ${table}: ${(dump.tables[table] || []).length}`);

  const host = (process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] || "невідомий хост";
  console.log(`\nЦе ПОВНІСТЮ ЗАМІНИТЬ усі дані в базі: ${host}`);
  const ok = await confirm('Введіть "yes" щоб продовжити: ');
  if (!ok) {
    console.log("Скасовано.");
    process.exit(0);
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    await client.query(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);

    for (const table of TABLES) {
      const rows = dump.tables[table] || [];
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      const insertSql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
      for (const row of rows) {
        await client.query(insertSql, columns.map((c) => row[c]));
      }

      // RESTART IDENTITY zeroed the sequence; inserting explicit ids never
      // advances it, so the next real INSERT would collide/restart too low.
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
        [table]
      );
    }

    await client.query("COMMIT");
    console.log("Відновлення завершено успішно.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
