const express = require("express");
const googleCalendar = require("../googleCalendar");

module.exports = function calendarRouter() {
  const router = express.Router();

  router.get("/status", async (req, res, next) => {
    try {
      res.json(await googleCalendar.status());
    } catch (err) {
      next(err);
    }
  });

  router.post("/connect", async (req, res, next) => {
    try {
      if (req.user.email !== googleCalendar.CALENDAR_OWNER_EMAIL) {
        return res.status(403).json({ error: "Підключити календар може лише партнерка." });
      }
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "Відсутній code." });
      await googleCalendar.connect(code);
      res.json(await googleCalendar.status());
    } catch (err) {
      next(err);
    }
  });

  router.post("/disconnect", async (req, res, next) => {
    try {
      if (req.user.email !== googleCalendar.CALENDAR_OWNER_EMAIL) {
        return res.status(403).json({ error: "Від'єднати календар може лише партнерка." });
      }
      await googleCalendar.disconnect();
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
};
