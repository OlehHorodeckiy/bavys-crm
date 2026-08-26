import { useMemo, useState } from "react";
import { api } from "../api";
import { useLiveData } from "../useLiveData";
import { Loading, ErrorBanner } from "../components/LoadError.jsx";
import OrderFormModal from "../components/OrderFormModal.jsx";
import { ALL_GAMES, FIXED_PRICE_GAMES, priceSelection } from "../pricing";
import { formatMoney, formatDate } from "../statuses";

export default function Calculator() {
  const clients = useLiveData(api.getClients);
  const calculations = useLiveData(() => api.getCalculations({ status: "active" }), []);

  const [selectedGames, setSelectedGames] = useState([]);
  const [tablesCount, setTablesCount] = useState(0);
  const [escortOn, setEscortOn] = useState(false);
  const [escortHours, setEscortHours] = useState(1);
  const [escortPeople, setEscortPeople] = useState(1);
  const [deliveryOn, setDeliveryOn] = useState(false);
  const [deliveryAmount, setDeliveryAmount] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [orderModalCalc, setOrderModalCalc] = useState(undefined);

  const pricing = useMemo(
    () => priceSelection(selectedGames, tablesCount, escortOn ? escortHours : 0, escortOn ? escortPeople : 0, deliveryOn ? deliveryAmount : 0),
    [selectedGames, tablesCount, escortOn, escortHours, escortPeople, deliveryOn, deliveryAmount]
  );

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q || !clients.data) return [];
    return clients.data.filter((c) => c.phone.includes(q) || c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [clientQuery, clients.data]);

  function toggleGame(name) {
    setSelectedGames((prev) => (prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]));
  }

  function clearAll() {
    setSelectedGames([]);
    setTablesCount(0);
    setEscortOn(false);
    setEscortHours(1);
    setEscortPeople(1);
    setDeliveryOn(false);
    setDeliveryAmount("");
    setSelectedClient(null);
    setClientQuery("");
  }

  const isEmpty = selectedGames.length === 0 && tablesCount === 0 && !escortOn && !deliveryOn;

  async function handleSave() {
    setSaving(true);
    try {
      await api.createCalculation({
        client_id: selectedClient?.id || null,
        games: selectedGames,
        tables_count: tablesCount,
        escort_hours: escortOn ? escortHours : 0,
        escort_people: escortOn ? escortPeople : 0,
        delivery_amount: deliveryOn ? Number(deliveryAmount) || 0 : 0,
      });
      clearAll();
      calculations.reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCalc(calc) {
    if (!window.confirm(`Видалити підрахунок №${calc.id}?`)) return;
    await api.deleteCalculation(calc.id);
    calculations.reload();
  }

  if (clients.loading) return <Loading />;
  if (clients.error) return <ErrorBanner message={clients.error} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Підрахунок</h1>
          <p>Клацніть все, що замовляє клієнт, і одразу отримайте готову суму</p>
        </div>
      </div>

      <div className="calc-layout">
        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <h3 className="section-title">Ігри</h3>
            <div className="game-grid">
              {ALL_GAMES.map((name) => {
                const fixedPrice = FIXED_PRICE_GAMES[name];
                const active = selectedGames.includes(name);
                return (
                  <button
                    type="button"
                    key={name}
                    className={`game-tile${active ? " active" : ""}`}
                    onClick={() => toggleGame(name)}
                  >
                    <span>{name}</span>
                    <span className="game-tile-price">{fixedPrice ? formatMoney(fixedPrice) : "пакет"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Додаткові послуги</h3>

            <div className="service-row">
              <div>
                <strong>Столи</strong>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>120 грн за стіл</div>
              </div>
              <div className="stepper">
                <button type="button" onClick={() => setTablesCount((n) => Math.max(0, n - 1))}>−</button>
                <span>{tablesCount}</span>
                <button type="button" onClick={() => setTablesCount((n) => n + 1)}>+</button>
              </div>
            </div>

            <div className="service-row">
              <div>
                <strong>Супровід</strong>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>300 грн / год / людина</div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={escortOn} onChange={(e) => setEscortOn(e.target.checked)} />
                <span>{escortOn ? "Додано" : "Додати"}</span>
              </label>
            </div>
            {escortOn && (
              <div className="form-row" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label>Годин</label>
                  <input type="number" min="1" className="input" value={escortHours} onChange={(e) => setEscortHours(Number(e.target.value) || 1)} />
                </div>
                <div className="field">
                  <label>Людей</label>
                  <input type="number" min="1" className="input" value={escortPeople} onChange={(e) => setEscortPeople(Number(e.target.value) || 1)} />
                </div>
              </div>
            )}

            <div className="service-row">
              <div>
                <strong>Доставка / логістика</strong>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>сума вводиться вручну</div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={deliveryOn} onChange={(e) => setDeliveryOn(e.target.checked)} />
                <span>{deliveryOn ? "Додано" : "Додати"}</span>
              </label>
            </div>
            {deliveryOn && (
              <div className="field">
                <label>Сума, грн</label>
                <input type="number" min="0" className="input" value={deliveryAmount} onChange={(e) => setDeliveryAmount(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <div className="card calc-summary">
          <h3 className="section-title">Поточний підрахунок</h3>

          <div className="field" style={{ position: "relative" }}>
            <label>Клієнт (необов'язково)</label>
            {selectedClient ? (
              <div className="selected-client">
                <div>
                  <strong>{selectedClient.name}</strong>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{selectedClient.phone}</div>
                </div>
                <button type="button" className="btn-ghost" style={{ height: 32, padding: "0 12px" }} onClick={() => setSelectedClient(null)}>
                  Змінити
                </button>
              </div>
            ) : (
              <>
                <input
                  className="input"
                  placeholder="Телефон або ім'я…"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                />
                {clientMatches.length > 0 && (
                  <div className="client-suggestions">
                    {clientMatches.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        className="client-suggestion-row"
                        onClick={() => { setSelectedClient(c); setClientQuery(""); }}
                      >
                        <span>{c.name}</span>
                        <span style={{ color: "var(--muted)" }}>{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {isEmpty ? (
            <div className="empty-state">Клацніть ігри чи послуги зліва</div>
          ) : (
            <div className="calc-line-items">
              {pricing.packageSelected.length > 0 && (
                <div className="calc-line-item calc-line-item-package">
                  <span>{pricing.packageSelected.join(", ")}</span>
                  <span>{formatMoney(pricing.packageSum)} (пакет)</span>
                </div>
              )}
              {pricing.fixedSelected.map((name) => (
                <div className="calc-line-item" key={name}>
                  <span>{name}</span>
                  <span>{formatMoney(FIXED_PRICE_GAMES[name])}</span>
                </div>
              ))}
              {tablesCount > 0 && (
                <div className="calc-line-item">
                  <span>{tablesCount} {tablesCount === 1 ? "стіл" : "столи"}</span>
                  <span>{formatMoney(pricing.tables)}</span>
                </div>
              )}
              {escortOn && (
                <div className="calc-line-item">
                  <span>Супровід ({escortHours} год × {escortPeople} люд)</span>
                  <span>{formatMoney(pricing.escort)}</span>
                </div>
              )}
              {deliveryOn && (
                <div className="calc-line-item">
                  <span>Доставка</span>
                  <span>{formatMoney(pricing.delivery)}</span>
                </div>
              )}
            </div>
          )}

          <div className="totals-box" style={{ marginTop: 14 }}>
            <div><span>Загальна сума</span><strong>{formatMoney(pricing.total)}</strong></div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button type="button" className="btn btn-ghost" onClick={clearAll} disabled={isEmpty}>Очистити</button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isEmpty || saving} style={{ flex: 1 }}>
              {saving ? "Збереження…" : "Зберегти підрахунок"}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, overflowX: "auto" }}>
        <h3 className="section-title">Активні підрахунки</h3>
        {calculations.loading ? (
          <Loading />
        ) : (calculations.data || []).length === 0 ? (
          <div className="empty-state">Збережених підрахунків ще немає</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Дата</th>
                <th>Клієнт</th>
                <th>Склад</th>
                <th>Сума</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {calculations.data.map((c) => (
                <tr key={c.id}>
                  <td>№{c.id}</td>
                  <td>{formatDate(c.created_at)}</td>
                  <td>{c.client_name || "—"}</td>
                  <td style={{ maxWidth: 260 }}>
                    {[...c.items.map((i) => i.game_name), c.tables_count > 0 ? `${c.tables_count} столи` : null, c.escort_hours > 0 ? "супровід" : null, c.delivery_amount > 0 ? "доставка" : null]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatMoney(c.total_amount)}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" style={{ height: 32, padding: "0 12px" }} onClick={() => setOrderModalCalc(c)}>
                      Додати до замовлення
                    </button>
                    <button className="row-delete-btn" title="Видалити" onClick={() => handleDeleteCalc(c)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {orderModalCalc !== undefined && (
        <OrderFormModal
          clients={clients.data}
          initialCalculation={orderModalCalc}
          onClose={() => setOrderModalCalc(undefined)}
          onSaved={() => calculations.reload()}
        />
      )}
    </div>
  );
}
