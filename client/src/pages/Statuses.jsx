import { Link } from "react-router-dom";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import { STATUS_PIPELINE, formatDate, formatMoney } from "../statuses";

const BOARD_STATUSES = STATUS_PIPELINE.filter((s) => s.value !== "cancelled");

export default function Statuses() {
  const orders = useLiveData(api.getOrders);

  if (orders.loading) return <Loading />;
  if (orders.error) return <ErrorBanner message={orders.error} />;

  async function changeStatus(order, newStatus) {
    await api.updateOrder(order.id, { status: newStatus });
    orders.reload();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Статуси замовлень</h1>
          <p>Канбан-дошка воронки замовлень — клікніть статус картки, щоб перемістити її</p>
        </div>
      </div>

      <div className="kanban">
        {BOARD_STATUSES.map((col) => {
          const items = orders.data.filter((o) => o.status === col.value);
          return (
            <div className="kanban-col" key={col.value}>
              <div className="kanban-col-title">
                <span style={{ color: col.color }}>{col.label}</span>
                <span style={{ color: "var(--text-muted)" }}>{items.length}</span>
              </div>
              {items.length === 0 && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Порожньо</div>}
              {items.map((o) => (
                <div className="kanban-card" key={o.id}>
                  <div className="kanban-card-name">
                    <Link className="client-link" to={`/clients/${o.client_id}`}>{o.client_name}</Link>
                  </div>
                  <div className="kanban-card-meta">
                    {o.event_type} · {formatDate(o.event_date)}<br />
                    {formatMoney(o.total_amount)}
                  </div>
                  <select
                    className="input kanban-select"
                    value={o.status}
                    onChange={(e) => changeStatus(o, e.target.value)}
                  >
                    {STATUS_PIPELINE.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
