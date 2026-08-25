import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { IconPhone, IconMessage, IconNote, IconRefresh } from "../components/icons.jsx";
import { formatDate, formatMoney } from "../statuses";

const TYPE_ICON = { call: IconPhone, message: IconMessage, note: IconNote, status_change: IconRefresh };

export default function ClientDetail() {
  const { id } = useParams();
  const client = useLiveData(() => api.getClient(id), [id]);
  const [text, setText] = useState("");
  const [type, setType] = useState("note");
  const [saving, setSaving] = useState(false);

  if (client.loading) return <Loading />;
  if (client.error) return <ErrorBanner message={client.error} />;

  const c = client.data;

  async function handleAddInteraction(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.createInteraction({ client_id: c.id, type, text });
      setText("");
      client.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link className="client-link" to="/clients">← Усі клієнти</Link>
          <h1 style={{ marginTop: 8 }}>{c.name}</h1>
          <p>{c.phone} · {c.source_channel || "джерело не вказано"}</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 className="section-title">Замовлення ({c.orders.length})</h3>
          {c.orders.length === 0 ? (
            <div className="empty-state">Замовлень ще немає</div>
          ) : (
            <table>
              <thead>
                <tr><th>Дата</th><th>Тип</th><th>Сума</th><th>Статус</th></tr>
              </thead>
              <tbody>
                {c.orders.map((o) => (
                  <tr key={o.id}>
                    <td>{formatDate(o.event_date)}</td>
                    <td>{o.event_type}</td>
                    <td style={{ fontWeight: 700 }}>{formatMoney(o.total_amount)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Додати взаємодію</h3>
          <form onSubmit={handleAddInteraction}>
            <div className="field">
              <label>Тип</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="note">Нотатка</option>
                <option value="call">Дзвінок</option>
                <option value="message">Повідомлення</option>
              </select>
            </div>
            <div className="field">
              <label>Опис</label>
              <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? "Збереження…" : "Додати"}</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Історія взаємодій</h3>
        {c.interactions.length === 0 ? (
          <div className="empty-state">Взаємодій ще немає</div>
        ) : (
          <div className="timeline">
            {c.interactions.map((i) => {
              const Icon = TYPE_ICON[i.type] || IconNote;
              return (
                <div className="timeline-item" key={i.id}>
                  <div className="timeline-dot"><Icon size={15} /></div>
                  <div>
                    <div className="timeline-text">{i.text}</div>
                    <div className="timeline-meta">{formatDate(i.created_at)} · {i.created_by}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
