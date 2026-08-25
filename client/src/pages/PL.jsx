import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import StatCard from "../components/StatCard.jsx";
import TransactionFormModal from "../components/TransactionFormModal.jsx";
import { IconCoins, IconGift, IconTrend, IconClock, IconLayers } from "../components/icons.jsx";
import { PERIOD_PRESETS, TRANSACTION_TYPES, periodToRange } from "../pl";
import { formatDate, formatMoney } from "../statuses";

const TYPE_LABEL = Object.fromEntries(TRANSACTION_TYPES.map((t) => [t.value, t.label]));

function monthLabel(m) {
  const [y, mm] = m.split("-");
  return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString("uk-UA", { month: "short", year: "2-digit" });
}

export default function PL() {
  const [preset, setPreset] = useState("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [modalTx, setModalTx] = useState(undefined);

  const { from, to } = useMemo(() => periodToRange(preset, custom), [preset, custom]);

  const summary = useLiveData(() => api.getPlSummary({ from, to }), [from, to]);
  const revenueBreakdown = useLiveData(() => api.getPlRevenueBreakdown({ from, to }), [from, to]);
  const expenseBreakdown = useLiveData(() => api.getPlExpenseBreakdown({ from, to }), [from, to]);
  const monthly = useLiveData(() => api.getPlMonthly(), []);
  const transactions = useLiveData(() => api.getTransactions({ from, to }), [from, to]);

  if (summary.loading) return <Loading />;
  if (summary.error) return <ErrorBanner message={summary.error} />;

  const s = summary.data;
  const rb = revenueBreakdown.data || {};
  const revenueRows = [
    { label: "Ігри", value: rb.games || 0 },
    { label: "Столи", value: rb.tables || 0 },
    { label: "Супровід", value: rb.escort || 0 },
    { label: "Логістика", value: rb.logistics || 0 },
  ].filter((r) => r.value > 0);

  const chartData = (monthly.data || []).map((m) => ({ ...m, label: monthLabel(m.month) }));

  async function handleDelete(tx) {
    if (!window.confirm(`Видалити операцію «${tx.description}»?`)) return;
    await api.deleteTransaction(tx.id);
    transactions.reload();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>P&L / Фінанси</h1>
          <p>Дохід, витрати, чистий прибуток і рух грошей бізнесу</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalTx(null)}>+ Додати витрату</button>
      </div>

      <div className="pill-row">
        {PERIOD_PRESETS.map((p) => (
          <button key={p.value} className={`pill${preset === p.value ? " active" : ""}`} onClick={() => setPreset(p.value)}>
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="form-row" style={{ maxWidth: 420, marginBottom: 20 }}>
          <div className="field">
            <label>Від</label>
            <input type="date" className="input" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          </div>
          <div className="field">
            <label>До</label>
            <input type="date" className="input" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        </div>
      )}

      <div className="grid grid-kpi" style={{ marginBottom: 18 }}>
        <StatCard icon={<IconCoins size={18} />} iconColor="var(--success, #5db872)" iconBg="#dcefe9" label="Дохід" value={formatMoney(s.revenue)} />
        <StatCard icon={<IconGift size={18} />} iconColor="var(--error)" iconBg="#f5dcdc" label="Витрати" value={formatMoney(s.expenses)} />
        <StatCard icon={<IconTrend size={18} />} iconColor="var(--primary)" iconBg="#f3ddd0" label="Чистий прибуток" value={formatMoney(s.net_profit)} />
        <StatCard icon={<IconLayers size={18} />} iconColor="var(--body)" iconBg="#e8e0d2" label="Баланс" value={formatMoney(s.balance)} />
      </div>
      <div className="stats-strip card" style={{ marginBottom: 18 }}>
        <div className="stats-strip-item">
          <span className="stats-strip-label">Очікується до отримання</span>
          <span className="stats-strip-value">{formatMoney(s.outstanding)}</span>
        </div>
        <div className="stats-strip-divider" />
        <div className="stats-strip-item">
          <span className="stats-strip-label">Замовлень у періоді</span>
          <span className="stats-strip-value">{s.orders_count}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="section-title">Дохід / Витрати / Прибуток по місяцях</h3>
        {chartData.length === 0 ? (
          <div className="empty-state">Ще немає даних для графіка</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
              <Tooltip formatter={(v) => formatMoney(v)} />
              <Legend />
              <Bar dataKey="revenue" name="Дохід" fill="#5db872" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Витрати" fill="#c64545" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="Прибуток" fill="#cc785c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3 className="section-title">Витрати за категоріями</h3>
          {(expenseBreakdown.data || []).length === 0 ? (
            <div className="empty-state">Немає витрат у цьому періоді</div>
          ) : (
            <table>
              <thead><tr><th>Категорія</th><th>Сума</th></tr></thead>
              <tbody>
                {expenseBreakdown.data.map((r) => (
                  <tr key={r.category}>
                    <td>{r.category}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Дохід за напрямками</h3>
          {revenueRows.length === 0 ? (
            <div className="empty-state">Немає доходу у цьому періоді</div>
          ) : (
            <table>
              <thead><tr><th>Напрямок</th><th>Сума</th></tr></thead>
              <tbody>
                {revenueRows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <h3 className="section-title">Операції</h3>
        {transactions.loading ? (
          <Loading />
        ) : (transactions.data || []).length === 0 ? (
          <div className="empty-state">Операцій у цьому періоді ще немає</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Опис</th>
                <th>Категорія</th>
                <th>Витрата</th>
                <th>Дохід</th>
                <th>Тип</th>
                <th>Оплата</th>
                <th>P&L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.data.map((t) => (
                <tr key={t.id} className="order-row" onClick={() => setModalTx(t)}>
                  <td>{formatDate(t.date)}</td>
                  <td>{t.description}</td>
                  <td>{t.category || "—"}</td>
                  <td>{t.flow === "out" ? formatMoney(t.amount) : "—"}</td>
                  <td>{t.flow === "in" ? formatMoney(t.amount) : "—"}</td>
                  <td>{TYPE_LABEL[t.type] || t.type}</td>
                  <td>{t.payment_method || "—"}</td>
                  <td>{t.affects_pl ? "так" : "ні"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="row-delete-btn" title="Видалити" onClick={() => handleDelete(t)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalTx !== undefined && (
        <TransactionFormModal
          transaction={modalTx}
          onClose={() => setModalTx(undefined)}
          onSaved={() => transactions.reload()}
          onDeleted={() => transactions.reload()}
        />
      )}
    </div>
  );
}
