const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Помилка запиту ${path}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getSummary: () => request("/dashboard/summary"),
  getRevenueByMonth: () => request("/dashboard/revenue-by-month"),
  getOrdersByStatus: () => request("/dashboard/orders-by-status"),
  getChannels: () => request("/dashboard/channels"),

  getOrders: () => request("/orders"),
  getStatuses: () => request("/orders/statuses"),
  createOrder: (data) => request("/orders", { method: "POST", body: JSON.stringify(data) }),
  updateOrder: (id, data) => request(`/orders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: "DELETE" }),

  getClients: () => request("/clients"),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request("/clients", { method: "POST", body: JSON.stringify(data) }),

  getStaff: () => request("/staff"),

  getInteractions: () => request("/interactions"),
  createInteraction: (data) => request("/interactions", { method: "POST", body: JSON.stringify(data) }),

  getTransactions: (params = {}) => request(`/transactions${qs(params)}`),
  getTransactionsMeta: () => request("/transactions/meta"),
  createTransaction: (data) => request("/transactions", { method: "POST", body: JSON.stringify(data) }),
  updateTransaction: (id, data) => request(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),

  getPlSummary: (params = {}) => request(`/pl/summary${qs(params)}`),
  getPlRevenueBreakdown: (params = {}) => request(`/pl/revenue-breakdown${qs(params)}`),
  getPlExpenseBreakdown: (params = {}) => request(`/pl/expense-breakdown${qs(params)}`),
  getPlMonthly: (params = {}) => request(`/pl/monthly${qs(params)}`),
};

function qs(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}
