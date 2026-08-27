import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import PaymentModal from "../components/PaymentModal.jsx";
import { STATUS_PIPELINE, PAYMENT_STATUSES, formatDate, formatMoney } from "../statuses";

const BOARD_STATUSES = STATUS_PIPELINE.filter((s) => s.value !== "cancelled");

export default function Statuses() {
  const orders = useLiveData(api.getOrders);
  const [draggedId, setDraggedId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [paymentRequest, setPaymentRequest] = useState(null);

  if (orders.loading) return <Loading />;
  if (orders.error) return <ErrorBanner message={orders.error} />;

  async function changeStatus(order, newStatus) {
    if (order.status === newStatus) return;
    const paymentKind = PAYMENT_STATUSES[newStatus];
    if (paymentKind) {
      setPaymentRequest({ order, kind: paymentKind });
      return;
    }
    await api.updateOrder(order.id, { status: newStatus });
    orders.reload();
  }

  function handleDrop(e, columnValue) {
    e.preventDefault();
    setOverColumn(null);
    const id = e.dataTransfer.getData("text/plain");
    const order = orders.data.find((o) => String(o.id) === id);
    if (order) changeStatus(order, columnValue);
    setDraggedId(null);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Статуси замовлень</h1>
          <p>Канбан-дошка воронки замовлень — перетягніть картку в інший стовпець або оберіть статус у списку</p>
        </div>
      </div>

      <div className="kanban">
        {BOARD_STATUSES.map((col) => {
          const items = orders.data.filter((o) => o.status === col.value);
          return (
            <div
              className={`kanban-col${overColumn === col.value ? " drag-over" : ""}`}
              key={col.value}
              onDragOver={(e) => { e.preventDefault(); setOverColumn(col.value); }}
              onDragLeave={() => setOverColumn((c) => (c === col.value ? null : c))}
              onDrop={(e) => handleDrop(e, col.value)}
            >
              <div className="kanban-col-title">
                <span style={{ color: col.color }}>{col.label}</span>
                <span style={{ color: "var(--text-muted)" }}>{items.length}</span>
              </div>
              {items.length === 0 && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Порожньо</div>}
              {items.map((o) => (
                <div
                  className={`kanban-card${draggedId === o.id ? " dragging" : ""}`}
                  key={o.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(o.id));
                    e.dataTransfer.effectAllowed = "move";
                    setDraggedId(o.id);
                  }}
                  onDragEnd={() => { setDraggedId(null); setOverColumn(null); }}
                >
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

      {paymentRequest && (
        <PaymentModal
          order={paymentRequest.order}
          kind={paymentRequest.kind}
          onClose={() => setPaymentRequest(null)}
          onSaved={() => orders.reload()}
        />
      )}
    </div>
  );
}
