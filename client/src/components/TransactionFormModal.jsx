import { useState } from "react";
import { api } from "../api";
import { TRANSACTION_TYPES, EXPENSE_CATEGORIES } from "../pl";
import { useBodyScrollLock } from "../useBodyScrollLock";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(tx) {
  if (tx) {
    return {
      date: tx.date,
      description: tx.description,
      category: tx.category || "",
      type: tx.type,
      flow: tx.flow,
      amount: tx.amount,
      payment_method: tx.payment_method || "",
      comment: tx.comment || "",
      affects_pl: tx.affects_pl,
    };
  }
  return {
    date: today(),
    description: "",
    category: "",
    type: "expense",
    flow: "out",
    amount: "",
    payment_method: "",
    comment: "",
    affects_pl: true,
  };
}

export default function TransactionFormModal({ transaction, onClose, onSaved, onDeleted }) {
  const isEdit = !!transaction;
  const [form, setForm] = useState(() => emptyForm(transaction));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  useBodyScrollLock();

  function update(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "type") {
        if (value === "personal") next.affects_pl = false;
        else if (value === "expense" || value === "income") next.affects_pl = true;
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        date: form.date,
        description: form.description,
        category: form.category || null,
        type: form.type,
        flow: form.flow,
        amount: Number(form.amount) || 0,
        payment_method: form.payment_method,
        comment: form.comment,
        affects_pl: form.affects_pl,
      };
      if (!payload.description || !payload.date || !payload.amount) {
        throw new Error("Заповніть дату, опис і суму");
      }
      if (isEdit) {
        await api.updateTransaction(transaction.id, payload);
      } else {
        await api.createTransaction(payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Видалити цю операцію?")) return;
    setDeleting(true);
    try {
      await api.deleteTransaction(transaction.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Операція" : "Нова витрата"}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="pill-row">
            {TRANSACTION_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                className={`pill${form.type === t.value ? " active" : ""}`}
                onClick={() => update("type", t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="form-row">
            <div className="field">
              <label>Дата</label>
              <input type="date" className="input" value={form.date} onChange={(e) => update("date", e.target.value)} />
            </div>
            <div className="field">
              <label>Сума, грн</label>
              <input type="number" min="0" className="input" value={form.amount} onChange={(e) => update("amount", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Опис</label>
            <input className="input" value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>

          <div className="form-row">
            <div className="field">
              <label>Категорія</label>
              <select className="input" value={form.category} onChange={(e) => update("category", e.target.value)}>
                <option value="">Без категорії</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Спосіб оплати</label>
              <input className="input" placeholder="Готівка, карта…" value={form.payment_method} onChange={(e) => update("payment_method", e.target.value)} />
            </div>
          </div>

          {form.type === "other" && (
            <div className="field">
              <label>Напрямок руху коштів</label>
              <select className="input" value={form.flow} onChange={(e) => update("flow", e.target.value)}>
                <option value="out">Витрата (гроші йдуть з балансу)</option>
                <option value="in">Надходження (гроші приходять на баланс)</option>
              </select>
            </div>
          )}

          {form.type !== "personal" && (
            <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="affects_pl"
                checked={form.affects_pl}
                onChange={(e) => update("affects_pl", e.target.checked)}
              />
              <label htmlFor="affects_pl" style={{ margin: 0 }}>Впливає на P&L (враховувати в прибутку)</label>
            </div>
          )}

          <div className="field">
            <label>Коментар</label>
            <textarea className="input" rows={2} value={form.comment} onChange={(e) => update("comment", e.target.value)} />
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
                {saving ? "Збереження…" : isEdit ? "Зберегти" : "Додати"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
