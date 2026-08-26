const express = require("express");
const db = require("../db");
const { ALL_GAMES, PACKAGE_GAMES, FIXED_PRICE_GAMES, priceGames, tablesTotal, escortTotal } = require("../pricing");

async function getLineItems(ownerType, ownerId) {
  const { rows } = await db.query(
    "SELECT * FROM line_items WHERE owner_type = $1 AND owner_id = $2 ORDER BY id",
    [ownerType, ownerId]
  );
  return rows;
}

async function replaceLineItems(ownerType, ownerId, items) {
  await db.query("DELETE FROM line_items WHERE owner_type = $1 AND owner_id = $2", [ownerType, ownerId]);
  for (const item of items) {
    await db.query(
      "INSERT INTO line_items (owner_type, owner_id, game_name, is_package, price) VALUES ($1,$2,$3,$4,$5)",
      [ownerType, ownerId, item.game_name, item.is_package, item.price]
    );
  }
}

function withTotals(calc, items) {
  const gamesTotal = items.reduce((sum, i) => sum + i.price, 0);
  const tables = tablesTotal(calc.tables_count);
  const escort = escortTotal(calc.escort_hours, calc.escort_people);
  return {
    ...calc,
    items,
    games_total: gamesTotal,
    tables_total: tables,
    escort_total: escort,
    total_amount: gamesTotal + tables + escort + calc.delivery_amount,
  };
}

async function loadCalculation(id) {
  const { rows } = await db.query(
    `SELECT c.*, cl.name AS client_name, cl.phone AS client_phone
     FROM calculations c LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = $1`,
    [id]
  );
  const calc = rows[0];
  if (!calc) return null;
  const items = await getLineItems("calculation", calc.id);
  return withTotals(calc, items);
}

module.exports = function calculationsRouter(emitChange) {
  const router = express.Router();

  router.get("/games", (req, res) => res.json({ allGames: ALL_GAMES, packageGames: PACKAGE_GAMES, fixedPriceGames: FIXED_PRICE_GAMES }));

  router.get("/", async (req, res, next) => {
    try {
      const { status } = req.query;
      const params = [];
      let where = "";
      if (status) { params.push(status); where = "WHERE c.status = $1"; }
      const { rows } = await db.query(
        `SELECT c.*, cl.name AS client_name, cl.phone AS client_phone
         FROM calculations c LEFT JOIN clients cl ON cl.id = c.client_id
         ${where} ORDER BY c.created_at DESC`,
        params
      );
      const withItems = await Promise.all(
        rows.map(async (c) => withTotals(c, await getLineItems("calculation", c.id)))
      );
      res.json(withItems);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const calc = await loadCalculation(req.params.id);
      if (!calc) return res.status(404).json({ error: "Підрахунок не знайдено" });
      res.json(calc);
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const body = req.body;
      const { rows } = await db.query(
        `INSERT INTO calculations (client_id, tables_count, escort_hours, escort_people, delivery_amount)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [body.client_id || null, body.tables_count || 0, body.escort_hours || 0, body.escort_people || 0, body.delivery_amount || 0]
      );
      const calc = rows[0];
      const { items } = priceGames(body.games || []);
      await replaceLineItems("calculation", calc.id, items);
      const full = await loadCalculation(calc.id);
      emitChange("calculation:created", full);
      res.status(201).json(full);
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const { rows: existingRows } = await db.query("SELECT * FROM calculations WHERE id = $1", [req.params.id]);
      const existing = existingRows[0];
      if (!existing) return res.status(404).json({ error: "Підрахунок не знайдено" });

      const body = req.body;
      const merged = { ...existing, ...body };
      await db.query(
        `UPDATE calculations SET client_id=$1, tables_count=$2, escort_hours=$3, escort_people=$4,
           delivery_amount=$5, status=$6, updated_at=NOW() WHERE id=$7`,
        [
          merged.client_id || null,
          merged.tables_count || 0,
          merged.escort_hours || 0,
          merged.escort_people || 0,
          merged.delivery_amount || 0,
          merged.status || "active",
          req.params.id,
        ]
      );
      if (body.games) {
        const { items } = priceGames(body.games);
        await replaceLineItems("calculation", req.params.id, items);
      }
      const full = await loadCalculation(req.params.id);
      emitChange("calculation:updated", full);
      res.json(full);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      await db.query("DELETE FROM line_items WHERE owner_type = 'calculation' AND owner_id = $1", [req.params.id]);
      const { rows } = await db.query("DELETE FROM calculations WHERE id = $1 RETURNING id", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Підрахунок не знайдено" });
      emitChange("calculation:deleted", { id: Number(req.params.id) });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
};

module.exports.loadCalculation = loadCalculation;
module.exports.getLineItems = getLineItems;
module.exports.replaceLineItems = replaceLineItems;
