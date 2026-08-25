import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import OrderFormModal from "../components/OrderFormModal.jsx";
import { formatDate, formatMoney, PAYMENT_STATUS_LABELS } from "../statuses";

export default function Orders() {
  const orders = useLiveData(api.getOrders);
  const clients = useLiveData(api.getClients);
  const staff = useLiveData(api.getStaff);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");

  if (orders.loading || clients.loading || staff.loading) return <Loading />;
  if (orders.error) return <ErrorBanner message={orders.error} />;

  const filtered =
    filter === "all" ? orders.data : orders.data.filter((o) => o.status === filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Замовлення</h1>
          <p>Усі заявки на ігрові програми та аніматорів</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Нове замовлення</button>
      </div>

      <div className="pill-row">
        <button className={`pill${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>Всі ({orders.data.length})</button>
        {["new", "confirmed", "advance_paid", "completed", "paid", "cancelled"].map((s) => {
          const count = orders.data.filter((o) => o.status === s).length;
          if (count === 0) return null;
          return (
            <button key={s} className={`pill${filter === s ? " active" : ""}`} onClick={() => setFilter(s)}>
              <StatusBadge status={s} /> {count}
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
                <th>Тип події</th>
                <th>Дата події</th>
                <th>Локація</th>
                <th>Сума</th>
                <th>Оплата</th>
                <th>Статус</th>
                <th>Відповідальний</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link className="client-link" to={`/clients/${o.client_id}`}>{o.client_name}</Link>
                  </td>
                  <td>{o.event_type}</td>
                  <td>{formatDate(o.event_date)}</td>
                  <td>{o.venue || "—"}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(o.total_amount)}</td>
                  <td>{PAYMENT_STATUS_LABELS[o.payment_status] || o.payment_status}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>{o.staff_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <OrderFormModal
          clients={clients.data}
          staff={staff.data}
          onClose={() => setShowForm(false)}
          onCreated={() => { orders.reload(); clients.reload(); }}
        />
      )}
    </div>
  );
}
