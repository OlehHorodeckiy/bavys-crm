// Single shared login for the whole team — HTTP Basic Auth. The browser
// caches the credentials after the first prompt and resends them on every
// request to this origin, including the Socket.IO handshake, so both the
// REST API and the realtime channel are protected the same way.
const USER = process.env.APP_USER || "";
const PASSWORD = process.env.APP_PASSWORD || "";

function parseBasicAuth(header) {
  if (!header || !header.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return null;
  return { user: decoded.slice(0, separatorIndex), pass: decoded.slice(separatorIndex + 1) };
}

function isValid(header) {
  if (!USER || !PASSWORD) return true; // auth disabled if not configured (local dev)
  const creds = parseBasicAuth(header);
  return !!creds && creds.user === USER && creds.pass === PASSWORD;
}

function expressBasicAuth(req, res, next) {
  if (isValid(req.headers.authorization)) return next();
  res.set("WWW-Authenticate", 'Basic realm="Bavys CRM"');
  res.status(401).send("Потрібен вхід.");
}

function socketAuth(socket, next) {
  if (isValid(socket.handshake.headers.authorization)) return next();
  next(new Error("unauthorized"));
}

module.exports = { expressBasicAuth, socketAuth, isConfigured: !!(USER && PASSWORD) };
