export const FIXED_PRICE_GAMES = {
  "Дженга": 1200,
  "Бір понг": 1500,
  "Реквізити для бір понгу": 500,
  "Алко-морський бій": 1500,
};

export const PACKAGE_GAMES = [
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

export const ALL_GAMES = [...PACKAGE_GAMES, ...Object.keys(FIXED_PRICE_GAMES)];

// Order-level "Ігри" composition block catalog — ALL_GAMES minus
// "Реквізити для бір понгу" (equipment rental, not a game).
export const ORDER_GAMES = [...PACKAGE_GAMES, ...Object.keys(FIXED_PRICE_GAMES).filter((g) => g !== "Реквізити для бір понгу")];

export const TABLE_PRICE = 120;
export const ESCORT_HOURLY_RATE = 400;
export const PACKAGE_GAME_PRICE = 850;

// Flat per-game price — no volume discount.
export function packagePrice(count) {
  return Math.max(count, 0) * PACKAGE_GAME_PRICE;
}

export function tablesTotal(count) {
  return Math.max(Number(count) || 0, 0) * TABLE_PRICE;
}

export function escortTotal(hours, people) {
  return Math.max(Number(hours) || 0, 0) * Math.max(Number(people) || 0, 0) * ESCORT_HOURLY_RATE;
}

export function priceSelection(gameNames, tablesCount, escortHours, escortPeople, deliveryAmount) {
  const packageSelected = gameNames.filter((g) => PACKAGE_GAMES.includes(g));
  const fixedSelected = gameNames.filter((g) => g in FIXED_PRICE_GAMES);
  const packageSum = packagePrice(packageSelected.length);
  const fixedSum = fixedSelected.reduce((sum, g) => sum + FIXED_PRICE_GAMES[g], 0);
  const tables = tablesTotal(tablesCount);
  const escort = escortTotal(escortHours, escortPeople);
  const delivery = Number(deliveryAmount) || 0;
  return {
    packageSelected,
    fixedSelected,
    packageSum,
    fixedSum,
    gamesTotal: packageSum + fixedSum,
    tables,
    escort,
    delivery,
    total: packageSum + fixedSum + tables + escort + delivery,
  };
}
