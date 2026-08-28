const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const { GOOGLE_CLIENT_ID, allowedEmails, issueSessionCookie, clearSessionCookie, verifySessionCookie } = require("../auth");

const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

module.exports = function authRouter() {
  const router = express.Router();

  router.post("/google", async (req, res, next) => {
    try {
      if (!client) return res.status(503).json({ error: "Вхід через Google не налаштовано." });

      const { credential } = req.body;
      if (!credential) return res.status(400).json({ error: "Відсутній credential." });

      const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();

      if (!payload.email_verified) {
        return res.status(403).json({ error: "Email не підтверджено Google." });
      }
      if (!allowedEmails().includes(String(payload.email).toLowerCase())) {
        return res.status(403).json({ error: "Цей email не має доступу до CRM." });
      }

      issueSessionCookie(res, payload.email);
      res.json({ email: payload.email });
    } catch (err) {
      if (err.message && err.message.includes("Token used too late")) {
        return res.status(401).json({ error: "Токен прострочено, спробуйте увійти ще раз." });
      }
      next(err);
    }
  });

  router.get("/me", (req, res) => {
    const session = verifySessionCookie(req.headers.cookie);
    if (!session) return res.status(401).json({ error: "Не авторизовано." });
    res.json(session);
  });

  router.post("/logout", (req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  return router;
};
