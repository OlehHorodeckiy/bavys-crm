import { useState } from "react";
import { api } from "../api";
import { PAYMENT_METHODS, formatMoney } from "../statuses";
import { useBodyScrollLock } from "../useBodyScrollLock";

// Adds or edits one real payment against an order. The resulting order
// status is always derived server-side from the total collected — never
// picked here — so a partial vs full amount naturally lands on the right
// status no matter which action opened this dialog.
export default function PaymentModal({ order, payment, onClose, onSaved, onDeleted }) {
  const isEdit = !!payment;
  // Ceiling this field can't exceed: remaining balance, plus (when editing)
  // the amount this payment already contributed to that remaining balance.
  const ceiling = Math.max((order.remaining_balance ?? 0) + (isEdit ? payment.amount : 0), 0);
  const [amount, setAmount] = useState(isEdit ? payment.amount : ceiling);
  const [method, setMethod] = useState(isEdit ? payment.method : "cash");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  useBodyScrollLock();

  async function handleSubmit(e) {
    e.preventDefault();
    const amountNum = Number(amount) || 0;
    if (amountNum <= 0) return setError("Вкажіть суму більшу за нуль");
    if (amountNum > ceiling) return setError(`Сума не може перевищувати ${formatMoney(ceiling)}`);
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await api.updateOrderPayment(order.id, payment.id, { amount: amountNum, method });
      } else {
        await api.addOrderPayment(order.id, { amount: amountNum, method });
      }
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Видалити цей платіж?")) return;
    setDeleting(true);
    try {
      await api.deleteOrderPayment(order.id, payment.id);
      onDeleted?.();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>{isEdit ? "Редагувати платіж" : "Оплата"}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 14 }}>
            {order.client_name ? `${order.client_name} · ` : ""}Можна внести до <strong>{formatMoney(ceiling)}</strong>
          </div>

          <div className="field">
            <label>Сума, грн</label>
            <input
              type="number"
              min="0"
              max={ceiling}
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Спосіб оплати</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {error && <div className="error-banner" style={{ padding: "10px 0" }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            {isEdit ? (
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Видалення…" : "Видалити"}
              </button>
            ) : <span />}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Скасувати</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Збереження…" : "Зберегти"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
