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
  const [modal, setModal] = useState(undefined); // undefined = closed, null-ish object = open

  const { from, to } = useMemo(() => periodToRange(preset, custom), [preset, custom]);

  const summary = useLiveData(() => api.getPlSummary({ from, to }), [from, to]);
  const allTime = useLiveData(() => api.getPlSummary({}), []);
  const revenueBreakdown = useLiveData(() => api.getPlRevenueBreakdown({ from, to }), [from, to]);
  const expenseBreakdown = useLiveData(() => api.getPlExpenseBreakdown({ from, to }), [from, to]);
  const monthly = useLiveData(() => api.getPlMonthly(), []);
  const transactions = useLiveData(() => api.getTransactions({ from, to }), [from, to]);

  if (summary.loading) return <Loading />;
  if (summary.error) return <ErrorBanner message={summary.error} />;

  const s = summary.data;
  const at = allTime.data;
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

  function reloadAll() {
    transactions.reload();
    allTime.reload();
  }

  const breakeven = at ? at.revenue - at.expenses : 0;
  const breakevenLabel = breakeven === 0 ? "Вийшли в нуль" : breakeven > 0 ? "Заробили" : "Ще не вийшли в нуль";
  const breakevenColor = breakeven === 0 ? "var(--muted)" : breakeven > 0 ? "var(--success, #5db872)" : "var(--error)";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>P&L / Фінанси</h1>
          <p>Дохід, витрати, чистий прибуток і рух грошей бізнесу</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setModal({ initialType: "capital" })}>+ Внести власні кошти</button>
          <button className="btn btn-primary" onClick={() => setModal({ initialType: "expense" })}>+ Додати витрату</button>
        </div>
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
        <StatCard icon={<IconLayers size={18} />} iconColor="var(--body)" iconBg="#e8e0d2" label="Поточний баланс" value={formatMoney(s.balance)} />
        <StatCard icon={<IconCoins size={18} />} iconColor="var(--success, #5db872)" iconBg="#dcefe9" label="Дохід" value={formatMoney(s.revenue)} />
        <StatCard icon={<IconGift size={18} />} iconColor="var(--error)" iconBg="#f5dcdc" label="Витрати" value={formatMoney(s.expenses)} />
        <StatCard icon={<IconTrend size={18} />} iconColor="var(--primary)" iconBg="#f3ddd0" label="Чистий прибуток" value={formatMoney(s.net_profit)} />
        <StatCard icon={<IconCoins size={18} />} iconColor="var(--muted)" iconBg="#efe9de" label="Власні кошти внесено" value={formatMoney(s.capital_contributed)} />
        <StatCard icon={<IconClock size={18} />} iconColor="var(--amber, #e8a55a)" iconBg="#f5e4d2" label="До отримання" value={formatMoney(s.outstanding)} />
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

      <div className="card" style={{ overflowX: "auto", marginBottom: 18 }}>
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
                <tr key={t.id} className="order-row" onClick={() => setModal({ transaction: t })}>
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

      {at && (
        <div className="card">
          <h3 className="section-title">За весь час</h3>
          <div className="grid grid-kpi" style={{ marginBottom: 16 }}>
            <StatCard icon={<IconCoins size={18} />} iconColor="var(--success, #5db872)" iconBg="#dcefe9" label="Зароблено" value={formatMoney(at.revenue)} />
            <StatCard icon={<IconGift size={18} />} iconColor="var(--error)" iconBg="#f5dcdc" label="Витрачено" value={formatMoney(at.expenses)} />
            <StatCard icon={<IconTrend size={18} />} iconColor="var(--primary)" iconBg="#f3ddd0" label="Прибуток" value={formatMoney(at.net_profit)} />
            <StatCard icon={<IconCoins size={18} />} iconColor="var(--muted)" iconBg="#efe9de" label="Власних коштів внесено" value={formatMoney(at.capital_contributed)} />
            <StatCard icon={<IconLayers size={18} />} iconColor="var(--body)" iconBg="#e8e0d2" label="Поточний баланс" value={formatMoney(at.balance)} />
          </div>
          <div className="totals-box" style={{ background: "transparent", border: `1px solid ${breakevenColor}`, padding: "16px 20px" }}>
            <div>
              <span>Точка 0 (дохід − витрати за весь час)</span>
              <strong style={{ color: breakevenColor }}>
                {breakevenLabel}{breakeven !== 0 ? `: ${formatMoney(Math.abs(breakeven))}` : ""}
              </strong>
            </div>
          </div>
        </div>
      )}

      {modal !== undefined && (
        <TransactionFormModal
          transaction={modal.transaction}
          initialType={modal.initialType}
          onClose={() => setModal(undefined)}
          onSaved={reloadAll}
          onDeleted={reloadAll}
        />
      )}
    </div>
  );
}
