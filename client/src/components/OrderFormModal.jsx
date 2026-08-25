import { useState } from "react";
import { api } from "../api";
import { STATUS_PIPELINE } from "../statuses";
import { useBodyScrollLock } from "../useBodyScrollLock";

const EVENT_TYPES = ["Дитяче свято", "Весілля", "Корпоратив", "День народження", "Інше"];

const emptyForm = {
  client_id: "",
  new_client_name: "",
  new_client_phone: "",
  event_type: "Дитяче свято",
  venue: "",
  status: "new",
  event_date: "",
  base_price: "",
  advance_amount: "",
  extra_services_fee: "",
  transport_fee: "",
  partner_discount: "",
  payment_status: "waiting",
  comment: "",
  assigned_staff_id: "",
};

export default function OrderFormModal({ clients, staff, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState(clients.length ? "existing" : "new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useBodyScrollLock();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let clientId = form.client_id;
      if (mode === "new") {
        if (!form.new_client_name || !form.new_client_phone) {
          throw new Error("Вкажіть ім'я і телефон нового клієнта");
        }
        const client = await api.createClient({
          name: form.new_client_name,
          phone: form.new_client_phone,
        });
        clientId = client.id;
      }
      if (!clientId) throw new Error("Оберіть клієнта");

      await api.createOrder({
        client_id: Number(clientId),
        event_type: form.event_type,
        venue: form.venue,
        status: form.status,
        event_date: form.event_date || null,
        base_price: Number(form.base_price) || 0,
        advance_amount: Number(form.advance_amount) || 0,
        extra_services_fee: Number(form.extra_services_fee) || 0,
        transport_fee: Number(form.transport_fee) || 0,
        partner_discount: Number(form.partner_discount) || 0,
        payment_status: form.payment_status,
        comment: form.comment,
        assigned_staff_id: form.assigned_staff_id ? Number(form.assigned_staff_id) : null,
      });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Нове замовлення</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="pill-row">
            <button type="button" className={`pill${mode === "existing" ? " active" : ""}`} onClick={() => setMode("existing")}>
              Існуючий клієнт
            </button>
            <button type="button" className={`pill${mode === "new" ? " active" : ""}`} onClick={() => setMode("new")}>
              Новий клієнт
            </button>
          </div>

          {mode === "existing" ? (
            <div className="field">
              <label>Клієнт</label>
              <select className="input" value={form.client_id} onChange={(e) => update("client_id", e.target.value)}>
                <option value="">Оберіть клієнта…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-row">
              <div className="field">
                <label>Ім'я клієнта</label>
                <input className="input" value={form.new_client_name} onChange={(e) => update("new_client_name", e.target.value)} />
              </div>
              <div className="field">
                <label>Телефон</label>
                <input className="input" value={form.new_client_phone} onChange={(e) => update("new_client_phone", e.target.value)} />
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="field">
              <label>Тип події</label>
              <select className="input" value={form.event_type} onChange={(e) => update("event_type", e.target.value)}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Локація / майданчик</label>
              <input className="input" value={form.venue} onChange={(e) => update("venue", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Дата події</label>
              <input type="date" className="input" value={form.event_date} onChange={(e) => update("event_date", e.target.value)} />
            </div>
            <div className="field">
              <label>Статус</label>
              <select className="input" value={form.status} onChange={(e) => update("status", e.target.value)}>
                {STATUS_PIPELINE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Вартість програми, грн</label>
              <input type="number" className="input" value={form.base_price} onChange={(e) => update("base_price", e.target.value)} />
            </div>
            <div className="field">
              <label>Аванс, грн</label>
              <input type="number" className="input" value={form.advance_amount} onChange={(e) => update("advance_amount", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Додаткові послуги, грн</label>
              <input type="number" className="input" value={form.extra_services_fee} onChange={(e) => update("extra_services_fee", e.target.value)} />
            </div>
            <div className="field">
              <label>Транспорт, грн</label>
              <input type="number" className="input" value={form.transport_fee} onChange={(e) => update("transport_fee", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Знижка партнера, грн</label>
              <input type="number" className="input" value={form.partner_discount} onChange={(e) => update("partner_discount", e.target.value)} />
            </div>
            <div className="field">
              <label>Оплата</label>
              <select className="input" value={form.payment_status} onChange={(e) => update("payment_status", e.target.value)}>
                <option value="waiting">Очікує оплати</option>
                <option value="partial">Частково оплачено</option>
                <option value="paid">Оплачено</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Відповідальний</label>
            <select className="input" value={form.assigned_staff_id} onChange={(e) => update("assigned_staff_id", e.target.value)}>
              <option value="">Не призначено</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Коментар</label>
            <textarea className="input" rows={2} value={form.comment} onChange={(e) => update("comment", e.target.value)} />
          </div>

          {error && <div className="error-banner" style={{ padding: "10px 0" }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Скасувати</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Збереження…" : "Створити замовлення"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
