import { useMemo, useState } from 'react';
import { CommitInput, parseMoney, ConfirmDialog, Modal, PaymentBlock } from '../ui.jsx';
import { useStore } from '../../store/StoreProvider.jsx';
import { uid } from '../../store/reducer.js';
import { changeFor, shortfallFor, validateAmount, round2, formatMoney } from '../../lib/pricing.js';
import { METHODS } from '../board/AddGuestPanel.jsx';

export const toLocalInput = (ts) => {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const parseLocal = (v) => {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? undefined : t;
};
const dayStart = (s) => new Date(s + 'T00:00:00').getTime();
const dayEnd = (s) => new Date(s + 'T23:59:59.999').getTime();

const COLS = [
  ['at', 'Date & time'], ['participant', 'Guest'], ['items', 'Items'], ['durationMin', 'Minutes'], ['price', 'Price'],
  ['paid', 'Paid'], ['change', 'Change'], ['method', 'Method'], ['notes', 'Notes'],
];

/** Record a one-off charge (label + any amount) straight into the ledger. */
function MiscDialog({ onClose }) {
  const { state, dispatch } = useStore();
  const { currency } = state.settings;
  const fm = (n) => formatMoney(n, currency);
  const [label, setLabel] = useState('');
  const [guest, setGuest] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [paid, setPaid] = useState('');
  const [tried, setTried] = useState(false);
  const price = Number(amount) > 0 ? round2(Number(amount)) : 0;
  const blocked = !price || !!validateAmount(paid) || shortfallFor(price, Number(paid)) > 0;

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (blocked) return;
    dispatch({
      type: 'TX_ADD',
      row: {
        id: uid(), at: Date.now(), sessionId: null, participant: guest.trim(), items: `Misc: ${label.trim() || 'Misc charge'}`,
        durationMin: 0, price, paid: Number(paid), change: changeFor(price, Number(paid)), method, notes: '',
      },
    });
    onClose();
  };

  return (
    <Modal title="Miscellaneous charge" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>What is it for?</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Charging fee, Water, Late fee" autoComplete="off" data-autofocus />
        </label>
        <div className="cols">
          <label className="field grow">
            <span>Guest (optional)</span>
            <input value={guest} onChange={(e) => setGuest(e.target.value)} autoComplete="off" />
          </label>
          <label className="field narrow">
            <span>Amount</span>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setPaid(e.target.value); }} placeholder="0" />
          </label>
        </div>
        {tried && !price && <p className="err" role="alert">Enter an amount greater than 0.</p>}
        <PaymentBlock total={price} method={method} setMethod={setMethod} paid={paid} setPaid={setPaid} fm={fm} showErrors={tried} />
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary big" disabled={tried && blocked}>Add {fm(price)}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function TransactionsTable() {
  const { state, dispatch } = useStore();
  const { transactions, settings } = state;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');
  const [sort, setSort] = useState({ key: 'at', dir: -1 });
  const [deleting, setDeleting] = useState(null);
  const [miscOpen, setMiscOpen] = useState(false);

  const rows = useMemo(() => {
    const list = transactions.filter(
      (t) => (!from || t.at >= dayStart(from)) && (!to || t.at <= dayEnd(to)) && (!method || t.method === method)
    );
    return list.sort((a, b) => {
      const x = a[sort.key] ?? '', y = b[sort.key] ?? '';
      return (typeof x === 'string' ? String(x).localeCompare(String(y)) : x - y) * sort.dir;
    });
  }, [transactions, from, to, method, sort]);

  const upd = (id, patch) => dispatch({ type: 'TX_UPDATE', id, patch });
  const updMoney = (t, key, v) => {
    const next = { ...t, [key]: v };
    upd(t.id, { [key]: v, ...(key !== 'change' ? { change: changeFor(next.price, next.paid) } : {}) });
  };
  const add = () =>
    dispatch({
      type: 'TX_ADD',
      row: { id: uid(), at: Date.now(), sessionId: null, participant: '', items: '', durationMin: 0, price: 0, paid: 0, change: 0, method: 'cash', notes: '' },
    });
  const th = (key) => (sort.key === key ? { 'aria-sort': sort.dir === 1 ? 'ascending' : 'descending' } : {});
  const total = round2(rows.reduce((n, t) => n + t.price, 0));

  return (
    <section aria-label="Transactions ledger" className="panel sheet">
      <div className="sheet-head">
        <h2>Transactions</h2>
        <div className="row wrap">
          <label className="inline">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="inline">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="inline">Method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">All</option>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          {(from || to || method) && <button className="link" onClick={() => { setFrom(''); setTo(''); setMethod(''); }}>Clear filters</button>}
          <button className="btn" onClick={add}>Add row</button>
          <button className="btn" onClick={() => setMiscOpen(true)}>+ Misc charge</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLS.map(([k, label]) => (
                <th key={k} {...th(k)}>
                  <button className="th-btn" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : 1 }))}>
                    {label} {sort.key === k ? (sort.dir === 1 ? '▲' : '▼') : ''}
                  </button>
                </th>
              ))}
              <th><span className="sr-only">Delete</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td><CommitInput type="datetime-local" value={t.at} format={toLocalInput} parse={parseLocal} onCommit={(v) => upd(t.id, { at: v })} aria-label="Date and time" /></td>
                <td><CommitInput value={t.participant} onCommit={(v) => upd(t.id, { participant: v })} aria-label="Guest" /></td>
                <td><CommitInput className="wide-cell" value={t.items ?? ''} onCommit={(v) => upd(t.id, { items: v })} aria-label="Items" /></td>
                <td><CommitInput className="num" inputMode="decimal" value={t.durationMin} parse={parseMoney} onCommit={(v) => upd(t.id, { durationMin: v })} aria-label="Minutes" /></td>
                <td><CommitInput className="num" inputMode="decimal" value={t.price} parse={parseMoney} onCommit={(v) => updMoney(t, 'price', v)} aria-label="Price" /></td>
                <td><CommitInput className="num" inputMode="decimal" value={t.paid} parse={parseMoney} onCommit={(v) => updMoney(t, 'paid', v)} aria-label="Paid" /></td>
                <td><CommitInput className="num" inputMode="decimal" value={t.change} parse={parseMoney} onCommit={(v) => updMoney(t, 'change', v)} aria-label="Change" /></td>
                <td>
                  <select value={t.method} onChange={(e) => upd(t.id, { method: e.target.value })} aria-label="Payment method">
                    {METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </td>
                <td><CommitInput value={t.notes} onCommit={(v) => upd(t.id, { notes: v })} aria-label="Notes" /></td>
                <td><button className="link danger cell-btn" onClick={() => setDeleting(t)} aria-label={`Delete row for ${t.participant || 'unnamed'}`}>Delete</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="muted center">No transactions{transactions.length ? ' match the filters' : ' yet. They appear here when you start a timer'}.</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={4}>{rows.length} rows</td><td>{formatMoney(total, settings.currency)}</td><td colSpan={5} /></tr>
          </tfoot>
        </table>
      </div>
      {miscOpen && <MiscDialog onClose={() => setMiscOpen(false)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete transaction?" danger confirmLabel="Delete"
          message={`Delete the ${formatMoney(deleting.price, settings.currency)} transaction for ${deleting.participant || 'this row'}? This changes your totals.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => { dispatch({ type: 'TX_DELETE', id: deleting.id }); setDeleting(null); }}
        />
      )}
    </section>
  );
}
