const { google } = require("googleapis");
const db = require("./db");
const { STATUS_PIPELINE } = require("./helpers");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const CALENDAR_OWNER_EMAIL = process.env.CALENDAR_OWNER_EMAIL || "";

const isConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && CALENDAR_OWNER_EMAIL);

function newOAuthClient() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
}

async function status() {
  if (!isConfigured) return { connected: false, needsReconnect: false };
  const { rows } = await db.query("SELECT last_error FROM calendar_auth WHERE email = $1", [CALENDAR_OWNER_EMAIL]);
  if (!rows[0]) return { connected: false, needsReconnect: false };
  return { connected: true, needsReconnect: !!rows[0].last_error };
}

// Exchanges a GIS code-client authorization code (popup mode → redirect_uri
// must be the literal string "postmessage") for tokens and stores the
// refresh_token. Requires prompt:'consent' to have been used on the
// frontend, or Google may not return a refresh_token on a repeat grant.
async function connect(code) {
  const oauth2Client = newOAuthClient();
  const { tokens } = await oauth2Client.getToken({ code, redirect_uri: "postmessage" });
  if (!tokens.refresh_token) {
    throw new Error("Google не повернув дозвіл на постійний доступ. Спробуйте від'єднати й підключити календар ще раз.");
  }
  await db.query(
    `INSERT INTO calendar_auth (email, refresh_token, access_token, access_token_expires_at, last_error, updated_at)
     VALUES ($1, $2, $3, $4, NULL, NOW())
     ON CONFLICT (email) DO UPDATE SET
       refresh_token = EXCLUDED.refresh_token,
       access_token = EXCLUDED.access_token,
       access_token_expires_at = EXCLUDED.access_token_expires_at,
       last_error = NULL,
       updated_at = NOW()`,
    [CALENDAR_OWNER_EMAIL, tokens.refresh_token, tokens.access_token || null, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
  );
}

async function disconnect() {
  await db.query("DELETE FROM calendar_auth WHERE email = $1", [CALENDAR_OWNER_EMAIL]);
}

async function getAuthorizedClient() {
  const { rows } = await db.query("SELECT * FROM calendar_auth WHERE email = $1", [CALENDAR_OWNER_EMAIL]);
  const row = rows[0];
  if (!row) return null;

  const oauth2Client = newOAuthClient();
  oauth2Client.setCredentials({
    refresh_token: row.refresh_token,
    access_token: row.access_token || undefined,
    expiry_date: row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : undefined,
  });

  // googleapis refreshes lazily before each request when the access token is
  // near expiry — this listener just persists whatever it minted so the
  // next order save doesn't need to refresh again.
  oauth2Client.on("tokens", (tokens) => {
    db.query(
      "UPDATE calendar_auth SET access_token=$1, access_token_expires_at=$2, updated_at=NOW() WHERE email=$3",
      [tokens.access_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null, CALENDAR_OWNER_EMAIL]
    ).catch(() => {});
  });

  return oauth2Client;
}

async function markError(message) {
  await db.query("UPDATE calendar_auth SET last_error=$1, updated_at=NOW() WHERE email=$2", [message, CALENDAR_OWNER_EMAIL]).catch(() => {});
}

async function clearError() {
  await db.query("UPDATE calendar_auth SET last_error=NULL WHERE email=$1", [CALENDAR_OWNER_EMAIL]).catch(() => {});
}

function addOneDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function buildEventBody(order, clientName) {
  const { rows: items } = await db.query(
    "SELECT game_name FROM line_items WHERE owner_type = 'order' AND owner_id = $1 ORDER BY id",
    [order.id]
  );
  const totalAmount = order.games_cost + order.tables_cost + order.escort_cost + order.logistics_cost;
  const statusLabel = STATUS_PIPELINE.find((s) => s.value === order.status)?.label || order.status;

  const lines = [];
  if (items.length) lines.push(`Ігри: ${items.map((i) => i.game_name).join(", ")}`);
  if (order.escort_hours || order.escort_people) lines.push(`Супровід: ${order.escort_hours || 0} год × ${order.escort_people || 0} люд`);
  if (order.logistics_cost) lines.push(`Логістика: ${order.logistics_cost} грн`);
  if (order.tables_cost) lines.push(`Столи: ${order.tables_cost} грн`);
  lines.push(`Сума: ${totalAmount} грн`);
  lines.push(`Статус: ${statusLabel}`);
  if (order.comment) lines.push(`Коментар: ${order.comment}`);

  return {
    summary: `${order.event_type} — ${clientName}`,
    location: order.venue || undefined,
    description: lines.join("\n"),
    // No time-of-day field exists on an order — always an all-day event.
    start: { date: order.event_date },
    end: { date: addOneDay(order.event_date) },
  };
}

// Best-effort: creates/updates/deletes the calendar event to match the
// order's current state. Never throws — a Google outage or an expired
// Testing-mode refresh token must never block saving the order itself.
// Returns the calendar_event_id the order should now be stored with.
async function syncCalendarForOrder(order, clientName) {
  if (!isConfigured) return order.calendar_event_id;
  try {
    const auth = await getAuthorizedClient();
    if (!auth) return order.calendar_event_id; // partner hasn't connected yet

    const calendar = google.calendar({ version: "v3", auth });
    const shouldHaveEvent = !!order.event_date && order.status !== "cancelled";

    if (!shouldHaveEvent) {
      if (order.calendar_event_id) {
        await calendar.events.delete({ calendarId: "primary", eventId: order.calendar_event_id }).catch((err) => {
          if (err.code !== 404 && err.code !== 410) throw err;
        });
      }
      await clearError();
      return null;
    }

    const requestBody = await buildEventBody(order, clientName);

    if (order.calendar_event_id) {
      await calendar.events.patch({ calendarId: "primary", eventId: order.calendar_event_id, requestBody });
      await clearError();
      return order.calendar_event_id;
    }

    const { data } = await calendar.events.insert({ calendarId: "primary", requestBody });
    await clearError();
    return data.id;
  } catch (err) {
    console.error("Синхронізація з Google Calendar не вдалася:", err.message || err);
    await markError(err.message || String(err));
    return order.calendar_event_id;
  }
}

module.exports = {
  isConfigured,
  CALENDAR_OWNER_EMAIL,
  status,
  connect,
  disconnect,
  syncCalendarForOrder,
};
