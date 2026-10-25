import { useMemo } from 'react';
import { CommitInput, parseMoney } from '../ui.jsx';
import { useStore } from '../../store/StoreProvider.jsx';
import { uid } from '../../store/reducer.js';
import { round2, formatMoney } from '../../lib/pricing.js';
import { toLocalInput } from './TransactionsTable.jsx';

export const CATEGORIES = ['rental', 'supplies', 'staff', 'electricity', 'other'];

const toDate = (ts) => toLocalInput(ts).slice(0, 10);
const parseDate = (v) => {
  const t = new Date(v + 'T12:00:00').getTime();
  return Number.isNaN(t) ? undefined : t;
};

export default function ExpensesTable() {
  const { state, dispatch } = useStore();
  const { expenses, settings } = state;
  const rows = useMemo(() => [...expenses].sort((a, b) => b.date - a.date), [expenses]);
  const upd = (id, patch) => dispatch({ type: 'EXP_UPDATE', id, patch });
  const add = () =>
    dispatch({ type: 'EXP_ADD', row: { id: uid(), date: Date.now(), category: 'supplies', description: '', amount: 0, paidWith: 'cash' } });
  const total = round2(expenses.reduce((n, e) => n + e.amount, 0));

  return (
    <section aria-label="Expenses" className="panel sheet">
      <div className="sheet-head">
        <h2>Expenses</h2>
        <button className="btn" onClick={add}>Add expense</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Paid with</th><th><span className="sr-only">Delete</span></th></tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td><CommitInput type="date" value={e.date} format={toDate} parse={parseDate} onCommit={(v) => upd(e.id, { date: v })} aria-label="Date" /></td>
                <td>
                  <select value={e.category} onChange={(ev) => upd(e.id, { category: ev.target.value })} aria-label="Category">
                    {[...new Set([...CATEGORIES, e.category])].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td><CommitInput value={e.description} onCommit={(v) => upd(e.id, { description: v })} aria-label="Description" /></td>
                <td><CommitInput className="num" inputMode="decimal" value={e.amount} parse={parseMoney} onCommit={(v) => upd(e.id, { amount: v })} aria-label="Amount" /></td>
                <td>
                  <select value={e.paidWith || 'cash'} onChange={(ev) => upd(e.id, { paidWith: ev.target.value })} aria-label="Paid with">
                    <option value="cash">cash (from till)</option>
                    <option value="other">other</option>
                  </select>
                </td>
                <td><button className="link danger cell-btn" onClick={() => dispatch({ type: 'EXP_DELETE', id: e.id })} aria-label="Delete expense">Delete</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted center">No expenses recorded.</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={3}>{rows.length} rows</td><td>{formatMoney(total, settings.currency)}</td><td colSpan={2} /></tr></tfoot>
        </table>
      </div>
    </section>
  );
}
