import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { STATUS_PIPELINE, PAYMENT_METHODS, EVENT_TYPES, formatDate, formatMoney } from "../statuses";
import { useBodyScrollLock } from "../useBodyScrollLock";
import PaymentModal from "./PaymentModal.jsx";

function emptyForm(order) {
  if (order) {
    return {
      event_type: order.event_type,
      venue: order.venue || "",
      event_date: order.event_date || "",
      status: order.status,
      games_cost: order.games_cost,
      tables_cost: order.tables_cost,
      escort_cost: order.escort_cost,
      logistics_cost: order.logistics_cost,
      comment: order.comment || "",
    };
  }
  return {
    event_type: "Дитяче свято",
    venue: "",
    event_date: "",
    status: "waiting_advance",
    games_cost: "",
    tables_cost: "",
    escort_cost: "",
    logistics_cost: "",
    advance_amount: "",
    payment_method: "cash",
    comment: "",
  };
}

function applyCalcToForm(calc, setForm, setSelectedClient) {
  setForm((f) => ({
    ...f,
    games_cost: calc.games_total,
    tables_cost: calc.tables_total,
    escort_cost: calc.escort_total,
    logistics_cost: calc.delivery_amount,
  }));
  if (calc.client_id) {
    setSelectedClient({ id: calc.client_id, name: calc.client_name, phone: calc.client_phone });
  }
}

export default function OrderFormModal({ clients, order, initialCalculation, onClose, onSaved, onDeleted }) {
  const isEdit = !!order;
  const [form, setForm] = useState(() => emptyForm(order));
  const [mode, setMode] = useState("existing");
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState(
    isEdit ? { id: order.client_id, name: order.client_name, phone: order.client_phone } : null
  );
  const [newClient, setNewClient] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [calculationId, setCalculationId] = useState(initialCalculation?.id || null);
  const [appliedCalc, setAppliedCalc] = useState(initialCalculation || null);
  const [activeCalcs, setActiveCalcs] = useState([]);
  const [liveOrder, setLiveOrder] = useState(order);
  const [payments, setPayments] = useState([]);
  const [paymentModal, setPaymentModal] = useState(null); // null=closed, {}=add, {payment}=edit
  useBodyScrollLock();

  useEffect(() => {
    if (isEdit) return;
    api.getCalculations({ status: "active" }).then(setActiveCalcs).catch(() => {});
  }, [isEdit]);

  useEffect(() => {
    if (initialCalculation) applyCalcToForm(initialCalculation, setForm, setSelectedClient);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fetchLive() {
    if (!isEdit) return Promise.resolve();
    return Promise.all([api.getOrder(order.id), api.getOrderPayments(order.id)]).then(([o, p]) => {
      setLiveOrder(o);
      setPayments(p);
      setForm((f) => ({ ...f, status: o.status }));
    });
  }

  // Called after a payment is added/edited/deleted from within this modal —
  // refreshes both the local view and the parent list (socket updates alone
  // don't reach a modal holding a stale order snapshot).
  function refreshOrder() {
    fetchLive();
    onSaved?.();
  }

  useEffect(() => {
    fetchLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickCalculation(id) {
    const calc = activeCalcs.find((c) => String(c.id) === String(id));
    setCalculationId(calc ? calc.id : null);
    setAppliedCalc(calc || null);
    if (calc) applyCalcToForm(calc, setForm, setSelectedClient);
  }

  const matches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return [];
    return clients
      .filter((c) => c.phone.includes(q) || c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [clientQuery, clients]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const num = (v) => Number(v) || 0;
  const totalAmount = num(form.games_cost) + num(form.tables_cost) + num(form.escort_cost) + num(form.logistics_cost);
  const collectedAmount = isEdit ? liveOrder.collected_amount || 0 : num(form.advance_amount);
  const remaining = Math.max(totalAmount - collectedAmount, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let clientId = selectedClient?.id;
      if (!isEdit && mode === "new") {
        if (!newClient.name || !newClient.phone) throw new Error("Вкажіть ім'я і телефон нового клієнта");
        const client = await api.createClient(newClient);
        clientId = client.id;
      }
      if (!clientId) throw new Error("Оберіть клієнта");

      const payload = {
        client_id: Number(clientId),
        event_type: form.event_type,
        venue: form.venue,
        event_date: form.event_date || null,
        status: form.status,
        games_cost: num(form.games_cost),
        tables_cost: num(form.tables_cost),
        escort_cost: num(form.escort_cost),
        logistics_cost: num(form.logistics_cost),
        comment: form.comment,
        calculation_id: calculationId || undefined,
      };

      if (isEdit) {
        await api.updateOrder(order.id, payload);
      } else {
        payload.advance_amount = num(form.advance_amount);
        payload.payment_method = form.payment_method;
        await api.createOrder(payload);
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
    if (!window.confirm("Видалити це замовлення? Дію не можна скасувати.")) return;
    setDeleting(true);
    try {
      await api.deleteOrder(order.id);
      onDeleted?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  async function handleDeletePayment(payment) {
    if (!window.confirm("Видалити цей платіж?")) return;
    await api.deleteOrderPayment(order.id, payment.id);
    refreshOrder();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Замовлення" : "Нове замовлення"}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {!isEdit && activeCalcs.length > 0 && (
            <div className="field">
              <label>Підрахунок (необов'язково)</label>
              <select className="input" value={calculationId || ""} onChange={(e) => pickCalculation(e.target.value)}>
                <option value="">Без підрахунку</option>
                {activeCalcs.map((c) => (
                  <option key={c.id} value={c.id}>
                    №{c.id} · {c.client_name || "без клієнта"} · {formatMoney(c.total_amount)}
                  </option>
                ))}
              </select>
              {appliedCalc && (
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 4 }}>
                  Суми заповнено з підрахунку №{appliedCalc.id} — можна відредагувати нижче.
                </div>
              )}
            </div>
          )}

          <div className="field">
            <label>Клієнт</label>
            {isEdit || selectedClient ? (
              <div className="selected-client">
                <div>
                  <strong>{selectedClient?.name}</strong>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{selectedClient?.phone}</div>
                </div>
                {!isEdit && (
                  <button type="button" className="btn-ghost" style={{ height: 32, padding: "0 12px" }} onClick={() => setSelectedClient(null)}>
                    Змінити
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="pill-row" style={{ marginBottom: 10 }}>
                  <button type="button" className={`pill${mode === "existing" ? " active" : ""}`} onClick={() => setMode("existing")}>
                    Існуючий клієнт
                  </button>
                  <button type="button" className={`pill${mode === "new" ? " active" : ""}`} onClick={() => setMode("new")}>
                    Новий клієнт
                  </button>
                </div>

                {mode === "existing" ? (
                  <div style={{ position: "relative" }}>
                    <input
                      className="input"
                      placeholder="Введіть номер телефону або ім'я…"
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                    />
                    {matches.length > 0 && (
                      <div className="client-suggestions">
                        {matches.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            className="client-suggestion-row"
                            onClick={() => {
                              setSelectedClient(c);
                              setClientQuery("");
                            }}
                          >
                            <span>{c.name}</span>
                            <span style={{ color: "var(--muted)" }}>{c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="form-row">
                    <input
                      className="input"
                      placeholder="Ім'я клієнта"
                      value={newClient.name}
                      onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))}
                    />
                    <input
                      className="input"
                      placeholder="Телефон"
                      value={newClient.phone}
                      onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="form-row">
            <div className="field">
              <label>Тип події</label>
              <select className="input" value={form.event_type} onChange={(e) => update("event_type", e.target.value)}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Адреса</label>
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
              <label>Вартість ігор, грн</label>
              <input type="number" min="0" className="input" value={form.games_cost} onChange={(e) => update("games_cost", e.target.value)} />
            </div>
            <div className="field">
              <label>Вартість столів, грн</label>
              <input type="number" min="0" className="input" value={form.tables_cost} onChange={(e) => update("tables_cost", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Вартість супроводу, грн</label>
              <input type="number" min="0" className="input" value={form.escort_cost} onChange={(e) => update("escort_cost", e.target.value)} />
            </div>
            <div className="field">
              <label>Логістика, грн</label>
              <input type="number" min="0" className="input" value={form.logistics_cost} onChange={(e) => update("logistics_cost", e.target.value)} />
            </div>
          </div>

          {!isEdit && (
            <div className="form-row">
              <div className="field">
                <label>Сума авансу, грн</label>
                <input
                  type="number"
                  min="0"
                  max={totalAmount}
                  className="input"
                  value={form.advance_amount}
                  onChange={(e) => update("advance_amount", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Спосіб оплати</label>
                <select className="input" value={form.payment_method} onChange={(e) => update("payment_method", e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="totals-box">
            <div><span>Загальна сума</span><strong>{formatMoney(totalAmount)}</strong></div>
            <div><span>Отримано</span><strong>{formatMoney(collectedAmount)}</strong></div>
            <div><span>До оплати</span><strong>{formatMoney(remaining)}</strong></div>
          </div>

          {isEdit && (
            <div className="field">
              <label>Платежі</label>
              {payments.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Ще немає платежів</div>
              ) : (
                <div>
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div>
                        <strong>{formatMoney(p.amount)}</strong>
                        <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: "0.85rem" }}>
                          {PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method} · {formatDate(p.date)}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ height: 28, padding: "0 10px" }}
                          onClick={() => setPaymentModal({ payment: p })}
                        >
                          Редагувати
                        </button>
                        <button type="button" className="row-delete-btn" title="Видалити" onClick={() => handleDeletePayment(p)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setPaymentModal({})}>
                + Додати платіж
              </button>
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
                {saving ? "Збереження…" : isEdit ? "Зберегти" : "Створити замовлення"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {paymentModal && (
        <PaymentModal
          order={{ ...liveOrder, total_amount: totalAmount, collected_amount: collectedAmount, remaining_balance: remaining }}
          payment={paymentModal.payment}
          onClose={() => setPaymentModal(null)}
          onSaved={() => { setPaymentModal(null); refreshOrder(); }}
          onDeleted={() => { setPaymentModal(null); refreshOrder(); }}
        />
      )}
    </div>
  );
}
