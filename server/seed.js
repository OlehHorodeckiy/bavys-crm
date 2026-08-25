// Заповнює БД реальними даними, перенесеними з аркуша «Замовлення»
// (рядки з ПРОЕКТ = Ігри) таблиці «Бавись клієнти.xlsx».
const db = require("./db");

const STAFF = [
  { name: "Маряна", position: "Власниця" },
  { name: "Ірина", position: "Адміністратор" },
  { name: "Наталя", position: "Адміністратор" },
];

// phone, name, venue, event_date (YYYY-MM-DD), base_price, extra_services_fee, transport_fee,
// payment_status (paid|waiting), status, comment
const ORDERS = [
  ["0676047064", "Настя", "Форест, весілля", "2026-05-02", 1600, 0, 0, "paid", "paid", ""],
  ["0666666666", "Клієнт без номера", "Виїзна подія", "2026-06-05", 1550, 0, 0, "paid", "paid", ""],
  ["0939134572", "Ярина", "Лісова пісня", "2026-06-12", 800, 0, 0, "paid", "paid", ""],
  ["0665582285", "Олена", "Круасани", "2026-06-13", 3000, 1170, 1100, "paid", "paid", ""],
  ["0677181832", "Ірина Туркевич", "Леополіс", "2026-06-18", 4500, 1470, 1200, "paid", "paid", ""],
  ["0939134572", "Ярина", "Лісова пісня", "2026-06-18", 800, 0, 0, "paid", "paid", ""],
  ["0673203782", "Solomka", "Село Папірня", "2026-06-20", 2300, 0, 1000, "paid", "paid", ""],
  ["0984491174", "Софія", "Форест, весілля", "2026-07-03", 1550, 0, 0, "paid", "paid", "самовивіз"],
  ["0980888241", "Hadzitskaa", "Форест, весілля", "2026-07-18", 3000, 360, 1000, "paid", "paid", ""],
  ["0987140049", "Анастасія", "Форест, весілля", "2026-07-26", 800, 0, 0, "paid", "paid", "самовивіз"],
  ["0630686156", "Ігор", "Форест, весілля", "2026-08-23", 4200, 90, 1600, "waiting", "completed", ""],
  ["0633280505", "Христина Семків", "Самовивіз", "2026-07-30", 800, 0, 0, "paid", "paid", ""],
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

  for (const [phone, name, venue, eventDate, basePrice, extraFee, transportFee, paymentStatus, status, comment] of ORDERS) {
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
        base_price, advance_amount, extra_services_fee, transport_fee, partner_discount,
        payment_status, comment, assigned_staff_id
      ) VALUES ($1, 'Весілля', $2, $3, $4, NULL, $5, 0, $6, $7, 0, $8, $9, $10)
      RETURNING id`,
      [clientId, venue, status, eventDate, basePrice, extraFee, transportFee, paymentStatus, comment, ownerStaffId]
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
