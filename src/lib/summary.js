import { round2 } from './pricing.js';

const sum = (arr, f) => round2(arr.reduce((t, x) => t + (Number(f(x)) || 0), 0));

export function groupSum(items, keyFn, valFn) {
  const out = {};
  for (const it of items) {
    const k = keyFn(it) || 'other';
    out[k] = round2((out[k] || 0) + (Number(valFn(it)) || 0));
  }
  return out;
}

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * transactions: { at, sessionId, price, paid, change, method, durationMin }
 *   (add-on-only sales have durationMin 0 and don't count as rest sessions)
 * expenses:     { amount, category, paidWith }
 */
export function summarize(transactions, expenses, startingFloat = 0) {
  const revenue = sum(transactions, (t) => t.price);
  const totalExpenses = sum(expenses, (e) => e.amount);
  const netProfit = round2(revenue - totalExpenses);
  const rest = transactions.filter((t) => t.durationMin > 0);
  const sessions = new Set(rest.map((t) => t.sessionId || t.id)).size;
  const totalMinutes = sum(rest, (t) => t.durationMin);
  const cash = transactions.filter((t) => t.method === 'cash');
  const cashExpenses = sum(expenses.filter((e) => (e.paidWith || 'cash') === 'cash'), (e) => e.amount);
  return {
    revenue,
    totalExpenses,
    netProfit,
    margin: revenue > 0 ? round2((netProfit / revenue) * 100) : 0,
    sessions,
    avgRevenuePerSession: sessions ? round2(revenue / sessions) : 0,
    avgSessionMinutes: sessions ? round2(totalMinutes / sessions) : 0,
    revenueByMethod: groupSum(transactions, (t) => t.method, (t) => t.price),
    expensesByCategory: groupSum(expenses, (e) => e.category, (e) => e.amount),
    cashInTill: round2(
      startingFloat + sum(cash, (t) => t.paid) - sum(cash, (t) => t.change) - cashExpenses
    ),
  };
}

/** Revenue buckets: by hour if all within one day, otherwise by day. Sorted ascending. */
export function revenueOverTime(transactions) {
  if (!transactions.length) return { unit: 'hour', buckets: [] };
  const days = new Set(transactions.map((t) => startOfDay(t.at)));
  const unit = days.size <= 1 ? 'hour' : 'day';
  const map = new Map();
  for (const t of transactions) {
    const d = new Date(t.at);
    if (unit === 'hour') d.setMinutes(0, 0, 0);
    else d.setHours(0, 0, 0, 0);
    map.set(d.getTime(), round2((map.get(d.getTime()) || 0) + (Number(t.price) || 0)));
  }
  const buckets = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([at, value]) => ({ at, value }));
  return { unit, buckets };
}
