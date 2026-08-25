import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import { formatMoney } from "../statuses";

function monthLabel(m) {
  const [y, mm] = m.split("-");
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("uk-UA", { month: "long", year: "numeric" });
}

export default function Finance() {
  const revenue = useLiveData(api.getRevenueByMonth);
  const staff = useLiveData(api.getStaff);

  if (revenue.loading || staff.loading) return <Loading />;
  if (revenue.error) return <ErrorBanner message={revenue.error} />;

  const rows = revenue.data;
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalOrders = rows.reduce((sum, r) => sum + r.orders_count, 0);
  const chartData = rows.map((r) => ({ label: monthLabel(r.month), revenue: r.revenue }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Доходи</h1>
          <p>Фінансові показники бізнесу — виручка, середній чек, ефективність команди</p>
        </div>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 20 }}>
        <div className="card kpi-card">
          <div className="kpi-label">Загальна виручка</div>
          <div className="kpi-value">{formatMoney(totalRevenue)}</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Всього замовлень</div>
          <div className="kpi-value">{totalOrders}</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Середній чек</div>
          <div className="kpi-value">{formatMoney(totalOrders ? totalRevenue / totalOrders : 0)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Виручка по місяцях</h3>
        {chartData.length === 0 ? (
          <div className="empty-state">Ще немає даних</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <Tooltip formatter={(v) => formatMoney(v)} />
              <Bar dataKey="revenue" fill="#cc785c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: "1fr" }}>
        <div className="card" style={{ overflowX: "auto" }}>
          <h3 className="section-title">Помісячна розбивка</h3>
          {rows.length === 0 ? (
            <div className="empty-state">Ще немає даних</div>
          ) : (
            <table>
              <thead>
                <tr><th>Місяць</th><th>К-ть замовлень</th><th>Виручка</th><th>Середній чек</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month}>
                    <td style={{ textTransform: "capitalize" }}>{monthLabel(r.month)}</td>
                    <td>{r.orders_count}</td>
                    <td style={{ fontWeight: 700 }}>{formatMoney(r.revenue)}</td>
                    <td>{formatMoney(r.orders_count ? r.revenue / r.orders_count : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20, overflowX: "auto" }}>
        <h3 className="section-title">Ефективність команди</h3>
        {staff.data.length === 0 ? (
          <div className="empty-state">Немає співробітників</div>
        ) : (
          <table>
            <thead>
              <tr><th>Ім'я</th><th>Посада</th><th>Замовлень</th><th>Оплачено</th><th>Виручка</th></tr>
            </thead>
            <tbody>
              {staff.data.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.position || "—"}</td>
                  <td>{s.orders_count}</td>
                  <td>{s.paid_orders_count || 0}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(s.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
