export const STATUS_PIPELINE = [
  { value: "waiting_advance", label: "Чекаємо аванс", color: "#E8A55A" },
  { value: "advance_paid", label: "Оплачений аванс", color: "#5B9BD5" },
  { value: "paid", label: "Оплачено", color: "#5DB872" },
  { value: "completed", label: "Подія проведена", color: "#CC785C" },
  { value: "cancelled", label: "Скасовано", color: "#C64545" },
];

export const STATUS_MAP = Object.fromEntries(STATUS_PIPELINE.map((s) => [s.value, s]));

export const PAYMENT_METHODS = [
  { value: "card", label: "Картка" },
  { value: "cash", label: "Готівка" },
];

export const EVENT_TYPES = ["Дитяче свято", "Весілля", "Корпоратив", "День народження", "Фестиваль"];

export function formatMoney(value) {
  return `${Math.round(value).toLocaleString("uk-UA")} грн`;
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
}
