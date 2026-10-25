// Pure money helpers. Amounts are plain numbers rounded to 2 decimals.

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Cheapest way to cover at least `minutes` of extra time using the extension tiers
 * (e.g. [{minutes: 5, price: 5}, {minutes: 15, price: 10}]). Each tier can be bought repeatedly.
 */
export function extensionPrice(minutes, tiers = []) {
  const m = Math.ceil(Number(minutes) - 1e-9);
  const valid = tiers.filter((t) => t.minutes > 0 && t.price >= 0);
  if (!(m > 0) || !valid.length) return 0;
  const cost = new Array(m + 1).fill(Infinity);
  cost[0] = 0;
  for (let x = 1; x <= m; x++) {
    for (const t of valid) cost[x] = Math.min(cost[x], cost[Math.max(0, x - t.minutes)] + t.price);
  }
  return round2(cost[m]);
}

/** Price of a rest booked in whole base blocks (e.g. ₱20 per 30 min: 30 min ₱20, 1 hr ₱40). */
export function priceFor(minutes, { baseMinutes, basePrice }) {
  if (!(minutes > 0) || !(baseMinutes > 0)) return 0;
  return round2(Math.ceil(minutes / baseMinutes - 1e-9) * basePrice);
}

export function addonsTotal(addons) {
  return round2(addons.reduce((n, a) => n + (Number(a.price) || 0), 0));
}

/** Change owed to the customer (never negative). */
export function changeFor(price, paid) {
  return round2(Math.max(0, paid - price));
}

/** Amount still missing when the customer paid too little (0 if fully paid). */
export function shortfallFor(price, paid) {
  return round2(Math.max(0, price - paid));
}

/** Price/change for adding `extraMinutes` to a running session. */
export function extensionQuote(extraMinutes, paid, settings) {
  const price = extensionPrice(extraMinutes, settings.extensions);
  return { price, change: changeFor(price, paid), shortfall: shortfallFor(price, paid) };
}

/** Validate a minutes value; returns an error message or null. */
export function validateMinutes(m) {
  if (m === '' || m == null || Number.isNaN(Number(m))) return 'Choose or enter a duration.';
  if (!(Number(m) > 0)) return 'Duration must be more than 0 minutes.';
  if (Number(m) > 600) return 'Duration looks too long (max 600 minutes).';
  return null;
}

/** Validate an amount paid; returns an error message or null. */
export function validateAmount(a) {
  if (a === '' || a == null || Number.isNaN(Number(a))) return 'Enter the amount paid.';
  if (Number(a) < 0) return 'Amount cannot be negative.';
  return null;
}

/** ₱20, ₱12.50, -₱3 */
export function formatMoney(n, currency = '₱') {
  const v = round2(n || 0);
  const abs = Math.abs(v);
  const body = Number.isInteger(abs) ? abs.toLocaleString('en-PH') : abs.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-' : '') + currency + body;
}
