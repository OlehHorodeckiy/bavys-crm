import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { IconCoins, IconGift, IconConfetti, IconUsers } from "../components/icons.jsx";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import { STATUS_MAP, formatDate, formatMoney } from "../statuses";

function monthLabel(m) {
  if (!m) return m;
  const [y, mm] = m.split("-");
  const d = new Date(Number(y), Number(mm) - 1, 1);
  return d.toLocaleDateString("uk-UA", { month: "short", year: "2-digit" });
}

export default function Dashboard() {
  const summary = useLiveData(api.getSummary);
  const revenue = useLiveData(api.getRevenueByMonth);
  const byStatus = useLiveData(api.getOrdersByStatus);
  const channels = useLiveData(api.getChannels);
  const orders = useLiveData(api.getOrders);

  if (summary.loading) return <Loading />;
  if (summary.error) return <ErrorBanner message={summary.error} />;

  const s = summary.data;
  const revenueChart = (revenue.data || []).map((r) => ({ ...r, label: monthLabel(r.month) }));
  const statusChart = (byStatus.data || []).map((r) => ({
    ...r,
    label: STATUS_MAP[r.status]?.label || r.status,
    color: STATUS_MAP[r.status]?.color || "#999",
  }));

  const allOrders = orders.data || [];
  const recentOrders = [...allOrders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const programTotals = new Map();
  for (const o of allOrders) {
    const key = o.event_type || "Інше";
    const entry = programTotals.get(key) || { name: key, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += o.total_amount;
    programTotals.set(key, entry);
  }
  const topPrograms = [...programTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Дашборд</h1>
          <p>Ключова статистика бізнесу «Бавись» — аніматори та ігрові програми</p>
        </div>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 14 }}>
        <StatCard icon={<IconCoins size={18} />} iconColor="var(--primary)" iconBg="#e6dfd8" label="Виручка цього місяця" value={formatMoney(s.month_revenue)} />
        <StatCard icon={<IconGift size={18} />} iconColor="var(--primary-active)" iconBg="#f3ddd0" label="Замовлень цього місяця" value={s.month_orders_count} />
        <StatCard icon={<IconConfetti size={18} />} iconColor="var(--amber)" iconBg="#f5e4d2" label="Нових клієнтів цього місяця" value={s.new_clients_this_month} />
        <StatCard icon={<IconUsers size={18} />} iconColor="var(--body)" iconBg="#e8e0d2" label="Клієнтів всього" value={s.total_clients} />
      </div>

      <div className="stats-strip card">
        <div className="stats-strip-item">
          <span className="stats-strip-label">Середній чек</span>
          <span className="stats-strip-value">{formatMoney(s.avg_check)}</span>
        </div>
        <div className="stats-strip-divider" />
        <div className="stats-strip-item">
          <span className="stats-strip-label">Замовлень всього</span>
          <span className="stats-strip-value">{s.total_orders}</span>
        </div>
        <div className="stats-strip-divider" />
        <div className="stats-strip-item">
          <span className="stats-strip-label">Подій найближчі 7 днів</span>
          <span className="stats-strip-value">{s.upcoming_events.length}</span>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 18, marginBottom: 18 }}>
        <div className="card">
          <h3 className="section-title">Виручка по місяцях</h3>
          {revenueChart.length === 0 ? (
            <div className="empty-state">Ще немає даних для графіка</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#cc785c" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Останні замовлення</h3>
          {recentOrders.length === 0 ? (
            <div className="empty-state">Замовлень ще немає</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentOrders.map((o) => (
                <div key={o.id} className="recent-order-row">
                  <div>
                    <Link className="client-link" to={`/clients/${o.client_id}`} style={{ fontWeight: 600 }}>
                      {o.client_name}
                    </Link>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {o.event_type} · {formatDate(o.event_date)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600 }}>{formatMoney(o.total_amount)}</div>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ marginTop: 14, marginBottom: 0 }}>
            <Link className="client-link" to="/orders">Усі замовлення →</Link>
          </p>
        </div>
      </div>

      <div className="grid grid-charts">
        <div className="card">
          <h3 className="section-title">Популярні програми</h3>
          {topPrograms.length === 0 ? (
            <div className="empty-state">Немає даних</div>
          ) : (
            <table>
              <thead>
                <tr><th>Програма</th><th>Замовлень</th><th>Виручка</th></tr>
              </thead>
              <tbody>
                {topPrograms.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.count}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Замовлення по статусах</h3>
          {statusChart.length === 0 ? (
            <div className="empty-state">Немає даних</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusChart} dataKey="count" nameKey="label" innerRadius={46} outerRadius={74} paddingAngle={3}>
                  {statusChart.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Канали залучення клієнтів</h3>
          {(channels.data || []).length === 0 ? (
            <div className="empty-state">Немає даних</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={channels.data} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis type="category" dataKey="channel" tick={{ fontSize: 12 }} width={100} stroke="var(--text-muted)" />
                <Tooltip />
                <Bar dataKey="count" fill="#e8a55a" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Найближчі події (7 днів)</h3>
          {s.upcoming_events.length === 0 ? (
            <div className="empty-state">Немає подій у найближчі 7 днів</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {s.upcoming_events.map((ev) => (
                <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{ev.client_name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{ev.venue}</div>
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{formatDate(ev.event_date)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
