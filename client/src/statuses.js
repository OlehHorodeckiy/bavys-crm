export const STATUS_PIPELINE = [
  { value: "new", label: "Новий", color: "#6C6A64" },
  { value: "confirmed", label: "Підтверджено", color: "#5DB8A6" },
  { value: "advance_paid", label: "Аванс отримано", color: "#E8A55A" },
  { value: "completed", label: "Проведено", color: "#CC785C" },
  { value: "paid", label: "Оплачено повністю", color: "#5DB872" },
  { value: "cancelled", label: "Скасовано", color: "#C64545" },
];

export const STATUS_MAP = Object.fromEntries(STATUS_PIPELINE.map((s) => [s.value, s]));

export const PAYMENT_STATUS_LABELS = {
  paid: "Оплачено",
  waiting: "Очікує оплати",
  partial: "Частково оплачено",
};

export function formatMoney(value) {
  return `${Math.round(value).toLocaleString("uk-UA")} грн`;
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
}
