import { useState } from "react";
import { api } from "../api";
import { PAYMENT_METHODS } from "../statuses";
import { formatMoney } from "../statuses";
import { useBodyScrollLock } from "../useBodyScrollLock";

const TITLES = {
  advance: "Оплата авансу",
  final: "Доплата",
};

// Records one real payment (advance or final) against an order and flips
// its status — the only way an order can reach "Оплачений аванс"/"Оплачено".
export default function PaymentModal({ order, kind, onClose, onSaved }) {
  const isFinal = kind === "final";
  const remaining = order.remaining_balance ?? Math.max(order.total_amount - (order.collected_amount || 0), 0);
  const [amount, setAmount] = useState(isFinal ? remaining : "");
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useBodyScrollLock();

  async function handleSubmit(e) {
    e.preventDefault();
    const amountNum = Number(amount) || 0;
    if (amountNum <= 0) {
      setError("Вкажіть суму більшу за нуль");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.addOrderPayment(order.id, { amount: amountNum, method, kind });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>{TITLES[kind]}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 14 }}>
            {order.client_name} · Залишок до оплати: <strong>{formatMoney(remaining)}</strong>
          </div>

          <div className="field">
            <label>{isFinal ? "Сума доплати, грн" : "Сума авансу, грн"}</label>
            <input
              type="number"
              min="0"
              className="input"
              value={amount}
              readOnly={isFinal}
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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Скасувати</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Збереження…" : "Підтвердити оплату"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
