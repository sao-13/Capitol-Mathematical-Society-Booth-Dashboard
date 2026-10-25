import test from 'node:test';
import assert from 'node:assert/strict';
import { priceFor, extensionPrice, addonsTotal, changeFor, shortfallFor, extensionQuote, validateMinutes, validateAmount, formatMoney } from './pricing.js';
import { remainingMs, statusOf, pause, resume, formatClock, extend, formatDuration } from './timing.js';
import { summarize, revenueOverTime } from './summary.js';
import { toCsv } from './csv.js';
import { toBackup, fromBackup } from '../store/storage.js';

test('backup round-trips and rejects other files', () => {
  const data = { settings: { currency: '₱' }, sessions: [{ id: 's1', startedAt: 5 }], transactions: [{ id: 't1' }], expenses: [], guestCounter: 3 };
  const back = fromBackup(toBackup(data));
  assert.deepEqual(back.sessions, data.sessions);
  assert.equal(back.guestCounter, 3);
  assert.equal(back.settings.basePrice, 20); // missing settings filled with defaults
  assert.throws(() => fromBackup('not json'), /not a Rest Booth backup/);
  assert.throws(() => fromBackup('{"app":"other"}'), /not a Rest Booth backup/);
});

// ₱20 for the first 30 min, ₱5 per extra 5 min, ₱10 per extra 15 min.
const rate = { baseMinutes: 30, basePrice: 20, extensions: [{ minutes: 5, price: 5 }, { minutes: 15, price: 10 }] };

test('extensionPrice picks the cheapest tier combination', () => {
  assert.equal(extensionPrice(5, rate.extensions), 5);
  assert.equal(extensionPrice(15, rate.extensions), 10);
  assert.equal(extensionPrice(3, rate.extensions), 5); // partial tier rounds up
  assert.equal(extensionPrice(10, rate.extensions), 10);
  assert.equal(extensionPrice(20, rate.extensions), 15); // 15 + 5
  assert.equal(extensionPrice(30, rate.extensions), 20); // 15 + 15
  assert.equal(extensionPrice(0, rate.extensions), 0);
  assert.equal(extensionPrice(5, []), 0);
});

test('priceFor: rest is booked in ₱20 / 30-min blocks', () => {
  assert.equal(priceFor(30, rate), 20);
  assert.equal(priceFor(60, rate), 40);
  assert.equal(priceFor(90, rate), 60);
  assert.equal(priceFor(10, rate), 20); // partial block rounds up
  assert.equal(priceFor(0, rate), 0);
  assert.equal(priceFor(-5, rate), 0);
});

test('addonsTotal', () => {
  assert.equal(addonsTotal([{ price: 25 }, { price: 50 }]), 75);
  assert.equal(addonsTotal([]), 0);
});

test('change and shortfall', () => {
  assert.equal(changeFor(5, 20), 15);
  assert.equal(changeFor(5, 5), 0);
  assert.equal(changeFor(5, 3), 0);
  assert.equal(shortfallFor(5, 3), 2);
  assert.equal(shortfallFor(5, 8), 0);
  assert.equal(changeFor(4.1, 10), 5.9); // floating point safe
});

test('extensionQuote', () => {
  assert.deepEqual(extensionQuote(5, 10, rate), { price: 5, change: 5, shortfall: 0 });
  assert.deepEqual(extensionQuote(15, 5, rate), { price: 10, change: 0, shortfall: 5 });
});

test('validation', () => {
  assert.ok(validateMinutes(''));
  assert.ok(validateMinutes(0));
  assert.equal(validateMinutes(15), null);
  assert.ok(validateAmount(-1));
  assert.ok(validateAmount(''));
  assert.equal(validateAmount(0), null);
  assert.equal(formatMoney(-3.5, '₱'), '-₱3.50');
  assert.equal(formatMoney(1200, '₱'), '₱1,200');
});

const mk = (o = {}) => ({ startedAt: 0, durationMs: 600000, pausedAt: null, pausedMs: 0, endedAt: null, ...o });

test('remaining uses timestamps and pause/resume', () => {
  assert.equal(remainingMs(mk(), 100000), 500000);
  const p = pause(mk(), 100000);
  assert.equal(remainingMs(p, 400000), 500000); // frozen while paused
  const r = resume(p, 400000);
  assert.equal(remainingMs(r, 500000), 400000);
  assert.equal(remainingMs(mk(), 700000), -100000);
  assert.equal(remainingMs(mk({ endedAt: 200000 }), 900000), 400000); // frozen when ended
});

test('statusOf thresholds', () => {
  const cfg = { amberPercent: 20, amberSeconds: 120 };
  assert.equal(statusOf(mk(), 0, cfg), 'green');
  assert.equal(statusOf(mk(), 490000, cfg), 'amber'); // 110s left < 120s
  assert.equal(statusOf(mk({ durationMs: 3600000 }), 3000000, cfg), 'amber'); // 10min = <20% of 60
  assert.equal(statusOf(mk(), 600000, cfg), 'expired');
  assert.equal(statusOf(mk({ endedAt: 1 }), 0, cfg), 'finished');
});

test('extend adds time; overdue time is forgiven', () => {
  assert.equal(remainingMs(extend(mk(), 5, 100000), 100000), 800000); // 500s left + 5 min
  const overdue = extend(mk(), 5, 780000); // 3 min overdue
  assert.equal(remainingMs(overdue, 780000), 300000); // exactly 5 min from now
  assert.equal(overdue.durationMs, 300000); // overdue time not carried into the timer at all
  assert.equal(statusOf(overdue, 780000, { amberPercent: 20, amberSeconds: 120 }), 'green');
  const longOverdue = extend(mk(), 15, 600000 + 45 * 60000); // 45 min overdue
  assert.equal(remainingMs(longOverdue, 600000 + 45 * 60000), 15 * 60000);
  const atZero = extend(mk(), 5, 600000); // exactly at 00:00
  assert.equal(remainingMs(atZero, 600000), 300000);
});

test('formatDuration', () => {
  assert.equal(formatDuration(30), '30 min');
  assert.equal(formatDuration(60), '1 hr');
  assert.equal(formatDuration(90), '1 hr 30 min');
});

test('formatClock', () => {
  assert.equal(formatClock(65000), '01:05');
  assert.equal(formatClock(3725000), '1:02:05');
  assert.equal(formatClock(-5000), '+00:05');
});

const tx = (o) => ({ at: new Date(2026, 0, 1, 10).getTime(), sessionId: 's1', price: 5, paid: 10, change: 5, method: 'cash', durationMin: 15, ...o });

test('summarize totals', () => {
  const txs = [tx({}), tx({ price: 5, paid: 5, change: 0, method: 'card', durationMin: 5 }), tx({ sessionId: 's2', price: 10, paid: 10, change: 0, durationMin: 30 })];
  const exp = [{ amount: 4, category: 'supplies', paidWith: 'cash' }, { amount: 6, category: 'rental', paidWith: 'other' }];
  const s = summarize(txs, exp, 50);
  assert.equal(s.revenue, 20);
  assert.equal(s.totalExpenses, 10);
  assert.equal(s.netProfit, 10);
  assert.equal(s.margin, 50);
  assert.equal(s.sessions, 2);
  assert.equal(s.avgRevenuePerSession, 10);
  assert.equal(s.avgSessionMinutes, 25);
  assert.deepEqual(s.revenueByMethod, { cash: 15, card: 5 });
  assert.deepEqual(s.expensesByCategory, { supplies: 4, rental: 6 });
  assert.equal(s.cashInTill, 50 + 20 - 5 - 4); // float + cash paid - change - cash expenses
});

test('add-on-only sales count as revenue but not as sessions', () => {
  const s = summarize([tx({}), tx({ id: 'a1', sessionId: null, price: 25, paid: 25, change: 0, durationMin: 0 })], [], 0);
  assert.equal(s.revenue, 30);
  assert.equal(s.sessions, 1);
  assert.equal(s.avgSessionMinutes, 15);
});

test('summarize with no data and loss', () => {
  const s = summarize([], [{ amount: 3, category: 'x' }], 0);
  assert.equal(s.netProfit, -3);
  assert.equal(s.margin, 0);
  assert.equal(s.sessions, 0);
});

test('revenueOverTime buckets', () => {
  const a = revenueOverTime([tx({}), tx({ at: new Date(2026, 0, 1, 10, 30).getTime() }), tx({ at: new Date(2026, 0, 1, 12).getTime() })]);
  assert.equal(a.unit, 'hour');
  assert.deepEqual(a.buckets.map((b) => b.value), [10, 5]);
  const b = revenueOverTime([tx({}), tx({ at: new Date(2026, 0, 3, 10).getTime() })]);
  assert.equal(b.unit, 'day');
});

test('toCsv escapes', () => {
  assert.equal(toCsv(['a', 'b'], [['x,y', 'say "hi"']]), 'a,b\r\n"x,y","say ""hi"""');
});
