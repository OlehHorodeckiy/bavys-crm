import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import { formatMoney } from "../statuses";

export default function Clients() {
  const clients = useLiveData(api.getClients);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", source_channel: "", notes: "" });
  const [error, setError] = useState(null);

  if (clients.loading) return <Loading />;
  if (clients.error) return <ErrorBanner message={clients.error} />;

  const filtered = clients.data.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.createClient(form);
      setForm({ name: "", phone: "", source_channel: "", notes: "" });
      setShowForm(false);
      clients.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Клієнти</h1>
          <p>База клієнтів «Бавись» — {clients.data.length} записів</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>+ Новий клієнт</button>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleAdd} style={{ marginBottom: 20 }}>
          <div className="form-row">
            <div className="field">
              <label>Ім'я</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Телефон</label>
              <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Канал залучення</label>
              <select className="input" value={form.source_channel} onChange={(e) => setForm({ ...form, source_channel: e.target.value })}>
                <option value="">Не вказано</option>
                <option>Instagram</option>
                <option>Viber</option>
                <option>Telegram</option>
                <option>Facebook</option>
                <option>Google</option>
                <option>Рекомендація</option>
                <option>Телефон</option>
              </select>
            </div>
            <div className="field">
              <label>Нотатка</label>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          {error && <div className="error-banner">{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Скасувати</button>
            <button type="submit" className="btn btn-primary">Зберегти</button>
          </div>
        </form>
      )}

      <input
        className="input"
        style={{ maxWidth: 320, marginBottom: 16 }}
        placeholder="Пошук за ім'ям або телефоном…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="card" style={{ overflowX: "auto" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">Клієнтів не знайдено</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ім'я</th>
                <th>Телефон</th>
                <th>Канал</th>
                <th>Замовлень</th>
                <th>Сума покупок</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td><Link className="client-link" to={`/clients/${c.id}`}>{c.name}</Link></td>
                  <td>{c.phone}</td>
                  <td>{c.source_channel || "—"}</td>
                  <td>{c.orders_count}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(c.total_spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
