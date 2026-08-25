export const TRANSACTION_TYPES = [
  { value: "expense", label: "Витрата" },
  { value: "income", label: "Дохід" },
  { value: "personal", label: "Особисте" },
  { value: "other", label: "Інше" },
];

export const EXPENSE_CATEGORIES = [
  "Реклама",
  "Реквізит / матеріали",
  "Зарплати / команда",
  "Транспорт",
  "Оренда",
  "Закупівлі",
  "Логістика",
  "Інше",
];

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d) {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const r = new Date(d);
  r.setDate(d.getDate() - day);
  return r;
}

export const PERIOD_PRESETS = [
  { value: "today", label: "Сьогодні" },
  { value: "week", label: "Цей тиждень" },
  { value: "month", label: "Цей місяць" },
  { value: "last_month", label: "Минулого місяця" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Рік" },
  { value: "custom", label: "Власний період" },
];

export function periodToRange(preset, custom) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { from: toISO(today), to: toISO(today) };
    case "week": {
      const start = startOfWeek(today);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: toISO(start), to: toISO(end) };
    }
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: toISO(start), to: toISO(end) };
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toISO(start), to: toISO(end) };
    }
    case "quarter": {
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3, 1);
      const end = new Date(today.getFullYear(), q * 3 + 3, 0);
      return { from: toISO(start), to: toISO(end) };
    }
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return { from: toISO(start), to: toISO(end) };
    }
    case "custom":
      return { from: custom?.from || "", to: custom?.to || "" };
    default:
      return { from: "", to: "" };
  }
}
