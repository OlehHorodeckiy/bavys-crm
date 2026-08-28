import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import { formatMoney } from "../statuses";

function monthLabel(m) {
  const [y, mm] = m.split("-");
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("uk-UA", { month: "long", year: "numeric" });
}

// Compact dd.mm — this table is a dense running log of individual
// payments, not a one-off date pick, so the short form reads faster.
function shortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function PaymentsTable({ title, icon, rows }) {
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <h3 className="section-title">{icon} {title}</h3>
      {rows.length === 0 ? (
        <div className="empty-state">Ще немає надходжень</div>
      ) : (
        <table>
          <thead>
            <tr><th>Дата</th><th>Сума</th><th>Опис</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{shortDate(r.date)}</td>
                <td style={{ fontWeight: 600 }}>{formatMoney(r.amount)}</td>
                <td>{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="totals-box" style={{ marginTop: 12 }}>
        <div><span>Всього {title.toLowerCase()}</span><strong>{formatMoney(total)}</strong></div>
      </div>
    </div>
  );
}

export default function Finance() {
  const revenue = useLiveData(api.getRevenueByMonth);
  const payments = useLiveData(api.getFinancePayments);

  if (revenue.loading || payments.loading) return <Loading />;
  if (revenue.error) return <ErrorBanner message={revenue.error} />;
  if (payments.error) return <ErrorBanner message={payments.error} />;

  const rows = revenue.data;
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalOrders = rows.reduce((sum, r) => sum + r.orders_count, 0);
  const chartData = rows.map((r) => ({ label: monthLabel(r.month), revenue: r.revenue }));

  const cashRows = payments.data.filter((p) => p.method === "cash");
  const cardRows = payments.data.filter((p) => p.method === "card");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Доходи</h1>
          <p>Фактичні надходження по готівці та картці</p>
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

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <PaymentsTable title="Готівка" icon="💵" rows={cashRows} />
        <PaymentsTable title="Картка" icon="💳" rows={cardRows} />
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
  );
}
