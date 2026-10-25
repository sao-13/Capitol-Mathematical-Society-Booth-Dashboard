import { useState } from 'react';
import { Modal, ConfirmDialog, CommitInput, parseMoney } from './ui.jsx';
import { useStore } from '../store/StoreProvider.jsx';
import { uid } from '../store/reducer.js';
import { SOUNDS, playAlarm } from '../audio/alarm.js';
import { formatMoney } from '../lib/pricing.js';
import { formatDuration } from '../lib/timing.js';
import { downloadFile } from '../lib/csv.js';
import { toBackup, fromBackup } from '../store/storage.js';

const parsePositive = (v) => {
  const n = Number(v);
  return String(v).trim() === '' || !(n > 0) ? undefined : n;
};
export default function Settings({ onClose }) {
  const { state, dispatch, reset } = useStore();
  const s = state.settings;
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(null);
  const [importMsg, setImportMsg] = useState(null);

  const exportAll = () => {
    const { undo, ...data } = state;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    downloadFile(`rest-booth-backup-${stamp}.json`, toBackup(data), 'application/json');
  };
  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(fromBackup(await file.text()));
      setImportMsg(null);
    } catch (err) {
      setImportMsg({ ok: false, text: err.message });
    }
  };
  const set = (patch) => dispatch({ type: 'SETTINGS', patch });
  const fm = (n) => formatMoney(n, s.currency);

  const setTier = (i, patch) => set({ extensions: s.extensions.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const setAddon = (i, patch) => set({ addons: s.addons.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  const test = (kind = s.alarmSound) => setTimeout(() => playAlarm(kind, s.volume), 50);

  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="settings">
        <section>
          <h3>Rest pricing</h3>
          <div className="cols">
            <label className="field"><span>Rest block (min)</span>
              <CommitInput inputMode="numeric" value={s.baseMinutes} parse={parsePositive} onCommit={(v) => set({ baseMinutes: v })} />
            </label>
            <label className="field"><span>Price per block</span>
              <CommitInput inputMode="decimal" value={s.basePrice} parse={parseMoney} onCommit={(v) => set({ basePrice: v })} />
            </label>
          </div>
          <p className="muted">Rest is booked in whole blocks: {formatDuration(s.baseMinutes)} {fm(s.basePrice)}, {formatDuration(s.baseMinutes * 2)} {fm(s.basePrice * 2)}, and so on.</p>
          <p className="label">Additional time (added from a guest's card)</p>
          <table className="mini">
            <thead><tr><th>Minutes</th><th>Price</th><th /></tr></thead>
            <tbody>
              {s.extensions.map((t, i) => (
                <tr key={i}>
                  <td><CommitInput inputMode="numeric" value={t.minutes} parse={parsePositive} onCommit={(v) => setTier(i, { minutes: v })} aria-label="Extra minutes" /></td>
                  <td><CommitInput inputMode="decimal" value={t.price} parse={parseMoney} onCommit={(v) => setTier(i, { price: v })} aria-label="Price" /></td>
                  <td><button className="link danger" onClick={() => set({ extensions: s.extensions.filter((_, j) => j !== i) })}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3>Add-ons</h3>
          <table className="mini">
            <thead><tr><th>Item</th><th>Price</th><th /></tr></thead>
            <tbody>
              {s.addons.map((a, i) => (
                <tr key={a.id}>
                  <td><CommitInput value={a.name} parse={(v) => v.trim() || undefined} onCommit={(v) => setAddon(i, { name: v })} aria-label="Add-on name" /></td>
                  <td><CommitInput inputMode="decimal" value={a.price} parse={parseMoney} onCommit={(v) => setAddon(i, { price: v })} aria-label="Add-on price" /></td>
                  <td><button className="link danger" onClick={() => set({ addons: s.addons.filter((_, j) => j !== i) })}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="link" onClick={() => set({ addons: [...s.addons, { id: uid(), name: 'New item', price: 0 }] })}>+ Add item</button>
        </section>

        <section>
          <h3>Money</h3>
          <div className="cols">
            <label className="field"><span>Currency symbol</span>
              <CommitInput value={s.currency} maxLength={4} onCommit={(v) => set({ currency: v.trim() || '₱' })} />
            </label>
            <label className="field"><span>Starting cash float</span>
              <CommitInput inputMode="decimal" value={s.startingFloat} parse={parseMoney} onCommit={(v) => set({ startingFloat: v })} />
            </label>
          </div>
        </section>

        <section>
          <h3>Timer warning</h3>
          <p className="muted">A card turns amber when either limit is reached.</p>
          <div className="cols">
            <label className="field"><span>Under % of time left</span>
              <CommitInput inputMode="numeric" value={s.amberPercent} parse={parsePositive} onCommit={(v) => set({ amberPercent: v })} />
            </label>
            <label className="field"><span>Under seconds left</span>
              <CommitInput inputMode="numeric" value={s.amberSeconds} parse={parsePositive} onCommit={(v) => set({ amberSeconds: v })} />
            </label>
          </div>
        </section>

        <section>
          <h3>Alarm</h3>
          <div className="cols">
            <label className="field"><span>Sound</span>
              <select value={s.alarmSound} onChange={(e) => { set({ alarmSound: e.target.value }); test(e.target.value); }}>
                {Object.entries(SOUNDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field"><span>Volume · {Math.round(s.volume * 100)}%</span>
              <input type="range" min="0" max="1" step="0.05" value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} />
            </label>
          </div>
          <div className="row">
            <label className="check"><input type="checkbox" checked={s.muted} onChange={(e) => set({ muted: e.target.checked })} /> Mute alarm</label>
            <button className="btn small" onClick={() => test()}>Play sound</button>
          </div>
        </section>

        <section>
          <h3>Data</h3>
          <p className="muted">
            Everything is saved in this browser only. To move to another device, export a backup here and import it there.
            It includes settings, guests and their running timers, transactions and expenses.
          </p>
          <div className="row wrap">
            <button className="btn" onClick={exportAll}>Export backup</button>
            <label className="btn file-btn">
              Import backup…
              <input type="file" accept=".json,application/json" onChange={pickFile} className="sr-only" />
            </label>
            <button className="btn danger" onClick={() => setConfirm(true)}>Clear all data…</button>
          </div>
          {importMsg && <p className={importMsg.ok ? 'muted' : 'err'} role="status">{importMsg.text}</p>}
        </section>

        <div className="row end"><button className="btn primary" onClick={onClose}>Done</button></div>
      </div>
      {pending && (
        <ConfirmDialog
          title="Import this backup?" danger confirmLabel="Replace my data"
          message={`This replaces everything on this device with the backup (${pending.sessions.length} guests, ${pending.transactions.length} transactions, ${pending.expenses.length} expenses). Running timers continue from where they are now. Export a backup of this device first if you need it.`}
          onCancel={() => setPending(null)}
          onConfirm={() => { dispatch({ type: 'IMPORT', data: pending }); setPending(null); setImportMsg({ ok: true, text: 'Backup imported.' }); }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title="Clear all data?" danger confirmLabel="Delete everything"
          message="This permanently deletes all guests, transactions, expenses and settings from this browser. Export your CSVs first if you need them."
          onCancel={() => setConfirm(false)}
          onConfirm={() => { reset(); setConfirm(false); onClose(); }}
        />
      )}
    </Modal>
  );
}
