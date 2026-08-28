const jwt = require("jsonwebtoken");
const { parseCookie } = require("cookie");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const ALLOWED_EMAILS_RAW = process.env.ALLOWED_EMAILS || "";

const SESSION_COOKIE = "bavys_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days — convenience over hygiene, low-stakes 2-person tool

const configuredCount = [GOOGLE_CLIENT_ID, SESSION_SECRET, ALLOWED_EMAILS_RAW].filter(Boolean).length;
const isConfigured = configuredCount === 3;
if (configuredCount > 0 && !isConfigured) {
  console.error(
    "Вхід через Google налаштовано частково — GOOGLE_CLIENT_ID/SESSION_SECRET/ALLOWED_EMAILS мають бути задані всі разом. " +
      "Зараз або вхід повністю вимкнений, або можуть заблокувати всіх — перевірте змінні середовища."
  );
}

function allowedEmails() {
  return ALLOWED_EMAILS_RAW.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function issueSessionCookie(res, email) {
  const token = jwt.sign({ email }, SESSION_SECRET, { expiresIn: SESSION_MAX_AGE_SECONDS });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

function clearSessionCookie(res) {
  const { maxAge, ...rest } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, rest);
}

// Verifies the raw `Cookie` header (works both for Express's `req.headers.cookie`
// and Socket.IO's `socket.handshake.headers.cookie` — neither has gone through
// Express's own cookie-parsing middleware at the point this is called for
// sockets). Re-checks the allowlist on every call, not just at sign-in, so
// revoking access is just editing ALLOWED_EMAILS — no waiting for the cookie
// to expire.
function verifySessionCookie(rawCookieHeader) {
  if (!isConfigured) return { email: "local-dev" };
  const parsed = parseCookie(rawCookieHeader || "");
  const token = parsed[SESSION_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    if (!allowedEmails().includes(String(payload.email).toLowerCase())) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

function sessionAuth(req, res, next) {
  const session = verifySessionCookie(req.headers.cookie);
  if (!session) return res.status(401).json({ error: "Потрібен вхід." });
  req.user = session;
  next();
}

function socketAuth(socket, next) {
  const session = verifySessionCookie(socket.handshake.headers.cookie);
  if (!session) return next(new Error("unauthorized"));
  next();
}

module.exports = {
  isConfigured,
  GOOGLE_CLIENT_ID,
  allowedEmails,
  issueSessionCookie,
  clearSessionCookie,
  verifySessionCookie,
  sessionAuth,
  socketAuth,
};
