import { useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthProvider.jsx";
import { api } from "../api";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CALENDAR_OWNER_EMAIL = import.meta.env.VITE_CALENDAR_OWNER_EMAIL;
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

// Visible only to the partner's own session — connecting/reconnecting her
// Google Calendar for order sync. Everyone else never sees this at all.
export default function CalendarConnect() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const codeClientRef = useRef(null);

  const isOwner = !!CALENDAR_OWNER_EMAIL && user.email === CALENDAR_OWNER_EMAIL;

  useEffect(() => {
    if (!isOwner) return;
    api.getCalendarStatus().then(setStatus).catch(() => {});
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner || !CLIENT_ID) return;

    async function handleCode(response) {
      if (response.error) {
        setError("Не вдалося підключити календар.");
        setConnecting(false);
        return;
      }
      try {
        const next = await api.connectCalendar(response.code);
        setStatus(next);
      } catch (err) {
        setError(err.message);
      } finally {
        setConnecting(false);
      }
    }

    let cancelled = false;
    function init() {
      if (cancelled || codeClientRef.current || !window.google?.accounts?.oauth2) return;
      codeClientRef.current = window.google.accounts.oauth2.initCodeClient({
        client_id: CLIENT_ID,
        scope: CALENDAR_SCOPE,
        ux_mode: "popup",
        access_type: "offline",
        prompt: "consent",
        callback: handleCode,
      });
    }

    if (window.google?.accounts?.oauth2) {
      init();
    } else {
      const interval = setInterval(init, 200);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
  }, [isOwner]);

  if (!isOwner || !status) return null;

  function handleConnect() {
    // Must fire synchronously from the click, no await before it, or popup
    // blockers in some browsers will kill the window.
    setError(null);
    setConnecting(true);
    codeClientRef.current?.requestCode();
  }

  const needsAction = !status.connected || status.needsReconnect;

  return (
    <div style={{ padding: "0 16px 12px", fontSize: "0.75rem" }}>
      {!needsAction && <div style={{ color: "var(--muted)" }}>Календар підключено</div>}
      {needsAction && (
        <button
          type="button"
          className="btn-ghost"
          style={{ height: 28, padding: "0 10px", fontSize: "0.72rem", width: "100%" }}
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? "Підключення…" : status.needsReconnect ? "Перепідключити календар" : "Підключити Google Calendar"}
        </button>
      )}
      {error && <div style={{ color: "var(--error)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
