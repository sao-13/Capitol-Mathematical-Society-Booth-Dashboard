import { useMemo } from 'react';
import { useStore } from '../../store/StoreProvider.jsx';
import { summarize, revenueOverTime } from '../../lib/summary.js';
import { formatMoney } from '../../lib/pricing.js';

export function BarChart({ buckets, unit, currency }) {
  if (!buckets.length) return <p className="muted">No revenue yet.</p>;
  const max = Math.max(...buckets.map((b) => b.value), 1);
  const W = 100 / buckets.length;
  const label = (at) =>
    unit === 'hour'
      ? new Date(at).toLocaleTimeString([], { hour: 'numeric' })
      : new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return (
    <div className="chart" role="img" aria-label={`Revenue by ${unit}`}>
      <div className="chart-bars">
        {buckets.map((b) => (
          <div key={b.at} className="chart-col" style={{ width: W + '%' }}>
            <span className="chart-val">{formatMoney(b.value, currency)}</span>
            <i style={{ height: Math.max(2, (b.value / max) * 100) + '%' }} />
          </div>
        ))}
      </div>
      <div className="chart-labels">
        {buckets.map((b) => <span key={b.at} style={{ width: W + '%' }}>{label(b.at)}</span>)}
      </div>
    </div>
  );
}

function Breakdown({ title, data, currency }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((e) => e[1]), 1);
  return (
    <div className="panel">
      <h3>{title}</h3>
      {entries.length === 0 && <p className="muted">Nothing yet.</p>}
      {entries.map(([k, v]) => (
        <div key={k} className="hbar">
          <span className="hbar-label">{k}</span>
          <span className="hbar-track"><i style={{ width: (v / max) * 100 + '%' }} /></span>
          <strong>{formatMoney(v, currency)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { state } = useStore();
  const { transactions, expenses, settings } = state;
  const cur = settings.currency;
  const s = useMemo(() => summarize(transactions, expenses, settings.startingFloat), [transactions, expenses, settings.startingFloat]);
  const over = useMemo(() => revenueOverTime(transactions), [transactions]);
  const fm = (n) => formatMoney(n, cur);
  const loss = s.netProfit < 0;

  return (
    <section aria-label="Financial summary" className="stack">
      <div className="tiles">
        <div className="tile"><span>Total revenue</span><strong>{fm(s.revenue)}</strong></div>
        <div className="tile"><span>Total expenses</span><strong>{fm(s.totalExpenses)}</strong></div>
        <div className={'tile' + (loss ? ' loss' : ' gain')}>
          <span>{loss ? 'Net loss' : 'Net profit'}</span><strong>{fm(s.netProfit)}</strong>
        </div>
        <div className="tile"><span>Profit margin</span><strong>{s.margin}%</strong></div>
        <div className="tile"><span>Sessions</span><strong>{s.sessions}</strong></div>
        <div className="tile"><span>Avg revenue / session</span><strong>{fm(s.avgRevenuePerSession)}</strong></div>
        <div className="tile"><span>Avg session length</span><strong>{s.avgSessionMinutes} min</strong></div>
        <div className="tile till"><span>Cash in till (est.)</span><strong>{fm(s.cashInTill)}</strong></div>
      </div>
      <div className="grid3">
        <Breakdown title="Revenue by payment method" data={s.revenueByMethod} currency={cur} />
        <Breakdown title="Expenses by category" data={s.expensesByCategory} currency={cur} />
        <div className="panel">
          <h3>Revenue by {over.unit}</h3>
          <BarChart buckets={over.buckets} unit={over.unit} currency={cur} />
        </div>
      </div>
    </section>
  );
}
