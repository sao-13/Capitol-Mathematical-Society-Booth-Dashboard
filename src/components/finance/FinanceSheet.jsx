import Dashboard, { BarChart } from './Dashboard.jsx';
import TransactionsTable, { toLocalInput } from './TransactionsTable.jsx';
import ExpensesTable from './ExpensesTable.jsx';
import { useStore } from '../../store/StoreProvider.jsx';
import { summarize, revenueOverTime } from '../../lib/summary.js';
import { formatMoney } from '../../lib/pricing.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';

export default function FinanceSheet() {
  const { state } = useStore();
  const { transactions, expenses, settings } = state;
  const stamp = new Date().toISOString().slice(0, 10);
  const fm = (n) => formatMoney(n, settings.currency);

  const exportLedger = () =>
    downloadCsv(`transactions-${stamp}.csv`, toCsv(
      ['Date & time', 'Guest', 'Items', 'Minutes', 'Price', 'Paid', 'Change', 'Method', 'Notes'],
      [...transactions].sort((a, b) => a.at - b.at).map((t) => [toLocalInput(t.at).replace('T', ' '), t.participant, t.items, t.durationMin, t.price, t.paid, t.change, t.method, t.notes])
    ));
  const exportExpenses = () =>
    downloadCsv(`expenses-${stamp}.csv`, toCsv(
      ['Date', 'Category', 'Description', 'Amount', 'Paid with'],
      [...expenses].sort((a, b) => a.date - b.date).map((e) => [toLocalInput(e.date).slice(0, 10), e.category, e.description, e.amount, e.paidWith || 'cash'])
    ));
  const exportSummary = () => {
    const s = summarize(transactions, expenses, settings.startingFloat);
    const rows = [
      ['Total revenue', s.revenue], ['Total expenses', s.totalExpenses], ['Net profit', s.netProfit],
      ['Profit margin %', s.margin], ['Sessions', s.sessions], ['Avg revenue per session', s.avgRevenuePerSession],
      ['Avg session minutes', s.avgSessionMinutes], ['Cash in till (estimate)', s.cashInTill],
      ...Object.entries(s.revenueByMethod).map(([k, v]) => [`Revenue - ${k}`, v]),
      ...Object.entries(s.expensesByCategory).map(([k, v]) => [`Expenses - ${k}`, v]),
    ];
    downloadCsv(`summary-${stamp}.csv`, toCsv(['Metric', 'Value'], rows));
  };

  return (
    <div className="finance">
      <div className="finance-head no-print">
        <h2>Finance Sheet</h2>
        <div className="row wrap">
          <span className="muted">Export CSV:</span>
          <button className="link" onClick={exportLedger}>Ledger</button>
          <button className="link" onClick={exportExpenses}>Expenses</button>
          <button className="link" onClick={exportSummary}>Summary</button>
          <button className="btn primary" onClick={() => window.print()}>Print end-of-day report</button>
        </div>
      </div>
      <div className="no-print stack">
        <Dashboard />
        <TransactionsTable />
        <ExpensesTable />
      </div>
      <PrintReport fm={fm} />
    </div>
  );
}

function PrintReport({ fm }) {
  const { state } = useStore();
  const { transactions, expenses, settings } = state;
  const s = summarize(transactions, expenses, settings.startingFloat);
  const over = revenueOverTime(transactions);
  return (
    <div className="print-only">
      <h1>Rest Booth · End-of-day report</h1>
      <p>Printed {new Date().toLocaleString()}</p>
      <h2>Summary</h2>
      <table>
        <tbody>
          <tr><td>Total revenue</td><td>{fm(s.revenue)}</td></tr>
          <tr><td>Total expenses</td><td>{fm(s.totalExpenses)}</td></tr>
          <tr><td>{s.netProfit < 0 ? 'Net LOSS' : 'Net profit'}</td><td>{fm(s.netProfit)}</td></tr>
          <tr><td>Profit margin</td><td>{s.margin}%</td></tr>
          <tr><td>Sessions</td><td>{s.sessions}</td></tr>
          <tr><td>Average revenue / session</td><td>{fm(s.avgRevenuePerSession)}</td></tr>
          <tr><td>Average session length</td><td>{s.avgSessionMinutes} min</td></tr>
          <tr><td>Starting float</td><td>{fm(settings.startingFloat)}</td></tr>
          <tr><td>Cash in till (estimate)</td><td>{fm(s.cashInTill)}</td></tr>
          {Object.entries(s.revenueByMethod).map(([k, v]) => <tr key={k}><td>Revenue — {k}</td><td>{fm(v)}</td></tr>)}
          {Object.entries(s.expensesByCategory).map(([k, v]) => <tr key={k}><td>Expenses — {k}</td><td>{fm(v)}</td></tr>)}
        </tbody>
      </table>
      <h2>Revenue by {over.unit}</h2>
      <BarChart buckets={over.buckets} unit={over.unit} currency={settings.currency} />
      <h2>Transactions</h2>
      <table className="grid">
        <thead><tr><th>Time</th><th>Guest</th><th>Items</th><th>Min</th><th>Price</th><th>Paid</th><th>Change</th><th>Method</th><th>Notes</th></tr></thead>
        <tbody>
          {[...transactions].sort((a, b) => a.at - b.at).map((t) => (
            <tr key={t.id}><td>{toLocalInput(t.at).replace('T', ' ')}</td><td>{t.participant}</td><td>{t.items}</td><td>{t.durationMin}</td><td>{fm(t.price)}</td><td>{fm(t.paid)}</td><td>{fm(t.change)}</td><td>{t.method}</td><td>{t.notes}</td></tr>
          ))}
        </tbody>
      </table>
      <h2>Expenses</h2>
      <table className="grid">
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
        <tbody>
          {[...expenses].sort((a, b) => a.date - b.date).map((e) => (
            <tr key={e.id}><td>{toLocalInput(e.date).slice(0, 10)}</td><td>{e.category}</td><td>{e.description}</td><td>{fm(e.amount)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
