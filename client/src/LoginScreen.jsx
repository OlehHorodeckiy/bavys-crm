import { useEffect, useRef, useState } from "react";
import Logo from "./components/Logo.jsx";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginScreen({ onSignedIn, error, setError }) {
  const buttonRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    async function handleCredentialResponse(response) {
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ credential: response.credential }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Не вдалося увійти.");
        }
        onSignedIn();
      } catch (err) {
        setError(err.message);
      }
    }

    let cancelled = false;
    function init() {
      if (cancelled || rendered || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredentialResponse });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
        });
        setRendered(true);
      }
    }

    if (window.google?.accounts?.id) {
      init();
    } else {
      const interval = setInterval(init, 200);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--canvas)",
      }}
    >
      <div
        className="card"
        style={{
          width: 340,
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          textAlign: "center",
        }}
      >
        <Logo height={30} color="var(--primary)" />
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Вхід</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
            Увійдіть через Google-акаунт, якому надано доступ
          </p>
        </div>

        {CLIENT_ID ? (
          <div ref={buttonRef} />
        ) : (
          <div className="error-banner">Вхід через Google не налаштовано (VITE_GOOGLE_CLIENT_ID).</div>
        )}

        {error && <div className="error-banner">{error}</div>}
      </div>
    </div>
  );
}
