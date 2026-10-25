import { useStore, useNow } from '../../store/StoreProvider.jsx';
import { statusOf } from '../../lib/timing.js';
import { startOfDay } from '../../lib/summary.js';
import { formatMoney, round2 } from '../../lib/pricing.js';

export default function SummaryBar() {
  const { state } = useStore();
  const now = useNow();
  const { sessions, transactions, settings } = state;
  let active = 0;
  let expired = 0;
  for (const s of sessions) {
    const st = statusOf(s, now, settings);
    if (st === 'green' || st === 'amber') active++;
    else if (st === 'expired') expired++;
  }
  const today = startOfDay(now);
  const collected = round2(transactions.filter((t) => t.at >= today).reduce((n, t) => n + t.price, 0));

  return (
    <dl className="stats" role="status">
      <div><dt>Resting</dt><dd>{active}</dd></div>
      <div className={expired ? 'alert' : ''}><dt>Time's up</dt><dd>{expired}</dd></div>
      <div><dt>Collected today</dt><dd>{formatMoney(collected, settings.currency)}</dd></div>
    </dl>
  );
}
