// Game pricing rules for the «Підрахунок» quote calculator.
const FIXED_PRICE_GAMES = {
  "Дженга": 1200,
  "Бір понг": 1500,
  "Реквізити для бір понгу": 400,
  "Алко-морський бій": 1500,
};

const PACKAGE_GAMES = [
  "Баланс",
  "4 в ряд",
  "Кільцекід",
  "Корнхол",
  "Галактика",
  "Шалені камені",
  "В одні ворота",
  "Мишоловка",
  "Рибалка",
  "На гачок",
  "Китайська ціна",
  "Кульбуто",
];

const ALL_GAMES = [...PACKAGE_GAMES, ...Object.keys(FIXED_PRICE_GAMES)];

// The catalog for the order-level "Ігри" composition block — same as
// ALL_GAMES minus "Реквізити для бір понгу", which is equipment rental,
// not a game, so it doesn't belong in per-game popularity analytics.
const ORDER_GAMES = [...PACKAGE_GAMES, ...Object.keys(FIXED_PRICE_GAMES).filter((g) => g !== "Реквізити для бір понгу")];

const TABLE_PRICE = 120;
const ESCORT_HOURLY_RATE = 300;

// 1→800, 2→1550, 3→2300, 4→3000, each one after that +750.
function packagePrice(count) {
  if (count <= 0) return 0;
  const steps = [800, 1550, 2300, 3000];
  if (count <= 4) return steps[count - 1];
  return 3000 + (count - 4) * 750;
}

// Splits a package's total evenly across the games in it, for per-game
// revenue reporting later — rounded so the parts always sum back to the total.
function splitPackageEvenly(total, count) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Builds the priced line items + totals for a set of selected game names.
function priceGames(gameNames = []) {
  const packageSelected = gameNames.filter((g) => PACKAGE_GAMES.includes(g));
  const fixedSelected = gameNames.filter((g) => g in FIXED_PRICE_GAMES);

  const packageTotal = packagePrice(packageSelected.length);
  const packageShares = splitPackageEvenly(packageTotal, packageSelected.length);

  const items = [
    ...packageSelected.map((name, i) => ({ game_name: name, is_package: true, price: packageShares[i] })),
    ...fixedSelected.map((name) => ({ game_name: name, is_package: false, price: FIXED_PRICE_GAMES[name] })),
  ];

  const fixedTotal = fixedSelected.reduce((sum, g) => sum + FIXED_PRICE_GAMES[g], 0);

  return { items, packageTotal, fixedTotal, gamesTotal: packageTotal + fixedTotal };
}

function tablesTotal(count) {
  return Math.max(Number(count) || 0, 0) * TABLE_PRICE;
}

function escortTotal(hours, people) {
  return Math.max(Number(hours) || 0, 0) * Math.max(Number(people) || 0, 0) * ESCORT_HOURLY_RATE;
}

module.exports = {
  FIXED_PRICE_GAMES,
  PACKAGE_GAMES,
  ALL_GAMES,
  ORDER_GAMES,
  TABLE_PRICE,
  ESCORT_HOURLY_RATE,
  packagePrice,
  priceGames,
  tablesTotal,
  escortTotal,
};
