const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const db = require("./db");
const { sessionAuth, socketAuth, isConfigured } = require("./auth");
const authRouter = require("./routes/auth");
const clientsRouter = require("./routes/clients");
const ordersRouter = require("./routes/orders");
const staffRouter = require("./routes/staff");
const interactionsRouter = require("./routes/interactions");
const dashboardRouter = require("./routes/dashboard");
const transactionsRouter = require("./routes/transactions");
const plRouter = require("./routes/pl");
const calculationsRouter = require("./routes/calculations");
const financeRouter = require("./routes/finance");
const calendarRouter = require("./routes/calendar");

const PORT = process.env.PORT || 4000;
const CLIENT_DIST = path.join(__dirname, "../client/dist");

// Cookies require an explicit origin allowlist — browsers reject a wildcard
// "*" combined with credentialed (cookie-carrying) requests.
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:5174"];
const CORS_ORIGINS = [...DEV_ORIGINS, process.env.RENDER_EXTERNAL_URL].filter(Boolean);

const app = express();
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json());

if (!isConfigured) {
  console.warn("GOOGLE_CLIENT_ID / SESSION_SECRET / ALLOWED_EMAILS не задані — CRM доступна без входу (годиться лише для локальної розробки).");
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGINS, credentials: true } });
io.use(socketAuth);

function emitChange(event, payload) {
  io.emit(event, payload);
  io.emit("data:changed", { event });
}

app.use("/api/auth", authRouter());
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api", sessionAuth);

app.use("/api/clients", clientsRouter(emitChange));
app.use("/api/orders", ordersRouter(emitChange));
app.use("/api/staff", staffRouter(emitChange));
app.use("/api/interactions", interactionsRouter(emitChange));
app.use("/api/dashboard", dashboardRouter());
app.use("/api/transactions", transactionsRouter(emitChange));
app.use("/api/pl", plRouter());
app.use("/api/calculations", calculationsRouter(emitChange));
app.use("/api/finance", financeRouter());
app.use("/api/calendar", calendarRouter());

app.use(express.static(CLIENT_DIST));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(CLIENT_DIST, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Внутрішня помилка сервера" });
});

io.on("connection", (socket) => {
  socket.on("disconnect", () => {});
});

db.init()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Бавись CRM запущено на http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Не вдалося підключитись до бази даних:", err);
    process.exit(1);
  });
