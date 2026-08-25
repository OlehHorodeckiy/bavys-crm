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

  getClients: () => request("/clients"),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request("/clients", { method: "POST", body: JSON.stringify(data) }),

  getStaff: () => request("/staff"),

  getInteractions: () => request("/interactions"),
  createInteraction: (data) => request("/interactions", { method: "POST", body: JSON.stringify(data) }),
};
