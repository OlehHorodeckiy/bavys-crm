const STATUS_PIPELINE = [
  { value: "waiting_advance", label: "Чекаємо аванс" },
  { value: "paid", label: "Оплачено" },
  { value: "completed", label: "Подія проведена" },
  { value: "cancelled", label: "Скасовано" },
];

function withOrderTotals(order) {
  const totalAmount = order.games_cost + order.tables_cost + order.escort_cost + order.logistics_cost;
  const remainingBalance = Math.max(totalAmount - order.advance_amount, 0);
  return { ...order, total_amount: totalAmount, remaining_balance: remainingBalance };
}

const TRANSACTION_TYPES = [
  { value: "expense", label: "Витрата" },
  { value: "income", label: "Дохід" },
  { value: "personal", label: "Особисте" },
  { value: "capital", label: "Власні кошти" },
  { value: "other", label: "Інше" },
];

const EXPENSE_CATEGORIES = [
  "Реклама",
  "Реквізит / матеріали",
  "Зарплати / команда",
  "Транспорт",
  "Оренда",
  "Закупівлі",
  "Логістика",
  "Інше",
];

module.exports = { STATUS_PIPELINE, withOrderTotals, TRANSACTION_TYPES, EXPENSE_CATEGORIES };
