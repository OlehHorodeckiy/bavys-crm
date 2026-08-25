// Заповнює БД реальними даними, перенесеними з аркуша «Замовлення»
// (рядки з ПРОЕКТ = Ігри) таблиці «Бавись клієнти.xlsx».
const db = require("./db");

const STAFF = [
  { name: "Маряна", position: "Власниця" },
  { name: "Ірина", position: "Адміністратор" },
  { name: "Наталя", position: "Адміністратор" },
];

// phone, name, venue, event_date (YYYY-MM-DD), games_cost, tables_cost, escort_cost,
// logistics_cost, status (waiting_advance|paid|completed|cancelled), comment
const ORDERS = [
  ["0676047064", "Настя", "Форест, весілля", "2026-05-02", 1600, 0, 0, 0, "paid", ""],
  ["0666666666", "Клієнт без номера", "Виїзна подія", "2026-06-05", 1550, 0, 0, 0, "paid", ""],
  ["0939134572", "Ярина", "Лісова пісня", "2026-06-12", 800, 0, 0, 0, "paid", ""],
  ["0665582285", "Олена", "Круасани", "2026-06-13", 3000, 270, 900, 1100, "paid", ""],
  ["0677181832", "Ірина Туркевич", "Леополіс", "2026-06-18", 4500, 270, 1200, 1200, "paid", ""],
  ["0939134572", "Ярина", "Лісова пісня", "2026-06-18", 800, 0, 0, 0, "paid", ""],
  ["0673203782", "Solomka", "Село Папірня", "2026-06-20", 2300, 0, 0, 1000, "paid", ""],
  ["0984491174", "Софія", "Форест, весілля", "2026-07-03", 1550, 0, 0, 0, "paid", "самовивіз"],
  ["0980888241", "Hadzitskaa", "Форест, весілля", "2026-07-18", 3000, 360, 0, 1000, "paid", ""],
  ["0987140049", "Анастасія", "Форест, весілля", "2026-07-26", 800, 0, 0, 0, "paid", "самовивіз"],
  ["0630686156", "Ігор", "Форест, весілля", "2026-08-23", 4200, 90, 0, 1600, "completed", ""],
  ["0633280505", "Христина Семків", "Самовивіз", "2026-07-30", 800, 0, 0, 0, "paid", ""],
];

async function run() {
  await db.init();

  const { rows: existingStaff } = await db.query("SELECT COUNT(*)::int AS count FROM staff");
  if (existingStaff[0].count > 0) {
    console.log("Дані вже є в базі — сідування пропущено (щоб не задублювати записи).");
    process.exit(0);
  }

  const staffIds = {};
  for (const s of STAFF) {
    const { rows } = await db.query("INSERT INTO staff (name, position) VALUES ($1, $2) RETURNING id", [
      s.name,
      s.position,
    ]);
    staffIds[s.name] = rows[0].id;
  }

  const ownerStaffId = staffIds["Маряна"];

  for (const [phone, name, venue, eventDate, gamesCost, tablesCost, escortCost, logisticsCost, status, comment] of ORDERS) {
    const { rows: existingClient } = await db.query("SELECT id FROM clients WHERE phone = $1", [phone]);
    let clientId;
    if (existingClient[0]) {
      clientId = existingClient[0].id;
    } else {
      const { rows } = await db.query("INSERT INTO clients (phone, name) VALUES ($1, $2) RETURNING id", [phone, name]);
      clientId = rows[0].id;
    }

    const { rows: orderRows } = await db.query(
      `INSERT INTO orders (
        client_id, event_type, venue, status, event_date, advance_date,
        games_cost, tables_cost, escort_cost, logistics_cost, advance_amount,
        comment, assigned_staff_id
      ) VALUES ($1, 'Весілля', $2, $3, $4, NULL, $5, $6, $7, $8, 0, $9, $10)
      RETURNING id`,
      [clientId, venue, status, eventDate, gamesCost, tablesCost, escortCost, logisticsCost, comment, ownerStaffId]
    );

    await db.query(
      "INSERT INTO interactions (client_id, order_id, type, text, created_by) VALUES ($1, $2, 'note', $3, 'import')",
      [clientId, orderRows[0].id, "Замовлення імпортовано з таблиці «Бавись клієнти.xlsx»"]
    );
  }

  console.log(`Готово: ${STAFF.length} співробітників, ${ORDERS.length} замовлень.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
