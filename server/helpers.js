const STATUS_PIPELINE = [
  { value: "waiting_advance", label: "Чекаємо аванс" },
  { value: "advance_paid", label: "Оплачений аванс" },
  { value: "paid", label: "Оплачено" },
  { value: "completed", label: "Подія проведена" },
  { value: "cancelled", label: "Скасовано" },
];

// Statuses that represent "money was just collected" — changing an order
// to one of these must go through POST /orders/:id/payments, never a plain
// status edit, so a payment record always exists to back it up.
const PAYMENT_STATUSES = { advance_paid: "advance", paid: "final" };

const PAYMENT_METHODS = [
  { value: "card", label: "Картка" },
  { value: "cash", label: "Готівка" },
];

// `order` must include a `collected_amount` field (SUM of its payments —
// see routes/orders.js), not the old single advance_amount number.
function withOrderTotals(order) {
  const totalAmount = order.games_cost + order.tables_cost + order.escort_cost + order.logistics_cost;
  const collected = order.collected_amount || 0;
  const remainingBalance = Math.max(totalAmount - collected, 0);
  return { ...order, total_amount: totalAmount, collected_amount: collected, remaining_balance: remainingBalance };
}

// Statuses whose position is derived from money collected, not chosen by
// hand — "Подія проведена" and "Скасовано" fall outside this and are never
// touched by a payment add/edit/delete.
const FORWARD_STATUSES = ["waiting_advance", "advance_paid", "paid"];

// The single source of truth for what a payment does to an order's status:
// full amount in → paid, partial → advance_paid, nothing collected →
// waiting_advance. Never depends on which action (create/edit/delete)
// triggered the recalculation, so the same payment total always yields the
// same status — that's what makes "one real payment = one credit" hold.
function deriveStatusFromCollected(currentStatus, collected, totalAmount) {
  if (!FORWARD_STATUSES.includes(currentStatus)) return currentStatus;
  if (collected <= 0) return "waiting_advance";
  if (collected >= totalAmount) return "paid";
  return "advance_paid";
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

module.exports = {
  STATUS_PIPELINE,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  withOrderTotals,
  FORWARD_STATUSES,
  deriveStatusFromCollected,
  TRANSACTION_TYPES,
  EXPENSE_CATEGORIES,
};
