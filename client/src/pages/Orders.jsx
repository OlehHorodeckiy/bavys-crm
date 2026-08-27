import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import OrderFormModal from "../components/OrderFormModal.jsx";
import PaymentModal from "../components/PaymentModal.jsx";
import { formatDate, formatMoney, STATUS_PIPELINE, PAYMENT_STATUSES } from "../statuses";

export default function Orders() {
  const orders = useLiveData(api.getOrders);
  const clients = useLiveData(api.getClients);
  const [modalOrder, setModalOrder] = useState(undefined);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [filter, setFilter] = useState("all");

  if (orders.loading || clients.loading) return <Loading />;
  if (orders.error) return <ErrorBanner message={orders.error} />;

  const filtered =
    filter === "all" ? orders.data : orders.data.filter((o) => o.status === filter);

  async function handleStatusChange(order, status) {
    if (status === order.status) return;
    if (PAYMENT_STATUSES[status]) {
      setPaymentRequest(order);
      return;
    }
    await api.updateOrder(order.id, { status });
    orders.reload();
  }

  async function handleDelete(order) {
    if (!window.confirm(`Видалити замовлення клієнта «${order.client_name}»?`)) return;
    await api.deleteOrder(order.id);
    orders.reload();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Замовлення</h1>
          <p>Усі заявки на ігрові програми та аніматорів</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOrder(null)}>+ Нове замовлення</button>
      </div>

      <div className="pill-row">
        <button className={`pill${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>Всі ({orders.data.length})</button>
        {STATUS_PIPELINE.map((s) => {
          const count = orders.data.filter((o) => o.status === s.value).length;
          if (count === 0) return null;
          return (
            <button key={s.value} className={`pill${filter === s.value ? " active" : ""}`} onClick={() => setFilter(s.value)}>
              <StatusBadge status={s.value} /> {count}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">Замовлень не знайдено</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Клієнт</th>
                <th>Дата події</th>
                <th>Локація</th>
                <th>Загальна сума</th>
                <th>Отримано</th>
                <th>До оплати</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="order-row" onClick={() => setModalOrder(o)}>
                  <td>
                    <Link className="client-link" to={`/clients/${o.client_id}`} onClick={(e) => e.stopPropagation()}>
                      {o.client_name}
                    </Link>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{o.client_phone}</div>
                  </td>
                  <td>{formatDate(o.event_date)}</td>
                  <td>{o.venue || "—"}</td>
                  <td style={{ fontWeight: 600 }}>{formatMoney(o.total_amount)}</td>
                  <td>{formatMoney(o.collected_amount)}</td>
                  <td style={{ fontWeight: 600, color: o.remaining_balance > 0 ? "var(--primary)" : "var(--success, #5db872)" }}>
                    {formatMoney(o.remaining_balance)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className="status-select"
                      value={o.status}
                      onChange={(e) => handleStatusChange(o, e.target.value)}
                    >
                      {STATUS_PIPELINE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="row-delete-btn" title="Видалити" onClick={() => handleDelete(o)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOrder !== undefined && (
        <OrderFormModal
          clients={clients.data}
          order={modalOrder}
          onClose={() => setModalOrder(undefined)}
          onSaved={() => { orders.reload(); clients.reload(); }}
          onDeleted={() => orders.reload()}
        />
      )}

      {paymentRequest && (
        <PaymentModal
          order={paymentRequest}
          onClose={() => setPaymentRequest(null)}
          onSaved={() => { setPaymentRequest(null); orders.reload(); }}
          onDeleted={() => { setPaymentRequest(null); orders.reload(); }}
        />
      )}
    </div>
  );
}
