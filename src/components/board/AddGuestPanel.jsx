import { useState } from 'react';
import { Modal, Segmented, PaymentBlock } from '../ui.jsx';
import { useStore } from '../../store/StoreProvider.jsx';
import { uid } from '../../store/reducer.js';
import { priceFor, addonsTotal, changeFor, shortfallFor, validateAmount, formatMoney, round2 } from '../../lib/pricing.js';
import { formatDuration } from '../../lib/timing.js';

export const METHODS = ['cash', 'card', 'other'];

export default function AddGuestPanel({ onClose }) {
  const { state, dispatch } = useStore();
  const { settings } = state;
  const [name, setName] = useState('');
  const [station, setStation] = useState('');
  const [blocks, setBlocks] = useState(1);
  const [picked, setPicked] = useState([]);
  const [method, setMethod] = useState('cash');
  const [paid, setPaid] = useState('');
  const [tried, setTried] = useState(false);
  const fm = (n) => formatMoney(n, settings.currency);

  const mins = blocks * settings.baseMinutes;
  const restPrice = priceFor(mins, settings);
  const addons = settings.addons.filter((a) => picked.includes(a.id));
  const total = round2(restPrice + addonsTotal(addons));
  const paidErr = validateAmount(paid);
  const blocked = !!paidErr || shortfallFor(total, Number(paid)) > 0;
  const guest = `Guest ${state.guestCounter + 1}`;

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (blocked) return;
    const now = Date.now();
    const id = uid();
    const guestName = name.trim() || guest;
    const change = changeFor(total, Number(paid));
    const items = [`Rest ${formatDuration(mins)}`, ...addons.map((a) => a.name)].join(' + ');
    dispatch({
      type: 'ADD_SESSION',
      usedGuest: !name.trim(),
      session: {
        id, name: guestName, station: station.trim(), startedAt: now, durationMs: mins * 60000, bookedMin: mins,
        pausedAt: null, pausedMs: 0, endedAt: null, dismissed: false,
        price: total, paid: Number(paid), change, method, addons: addons.map((a) => a.name),
      },
      transaction: {
        id: uid(), at: now, sessionId: id, participant: guestName, items, durationMin: mins,
        price: total, paid: Number(paid), change, method, notes: '',
      },
    });
    onClose();
  };

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const restOpts = Array.from({ length: settings.restOptions || 6 }, (_, i) => {
    const m = (i + 1) * settings.baseMinutes;
    return [String(i + 1), formatDuration(m), fm(priceFor(m, settings))];
  });

  return (
    <Modal title="New guest" onClose={onClose} wide>
      <form onSubmit={submit} className="form">
        <div className="cols">
          <label className="field grow">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={guest} autoComplete="off" data-autofocus />
          </label>
          <label className="field narrow">
            <span>Station</span>
            <input value={station} onChange={(e) => setStation(e.target.value)} placeholder="—" autoComplete="off" />
          </label>
        </div>

        <div className="field">
          <span>Rest time</span>
          <Segmented label="Rest time" value={String(blocks)} onChange={(v) => setBlocks(Number(v))} options={restOpts} />
          <p className="muted">
            Additional time can be added later from the guest's card:{' '}
            {settings.extensions.map((t) => `+${t.minutes} min ${fm(t.price)}`).join(', ')}.
          </p>
        </div>

        {settings.addons.length > 0 && (
          <div className="field">
            <span>Add-ons</span>
            <div className="addon-list">
              {settings.addons.map((a) => (
                <label key={a.id} className={'addon' + (picked.includes(a.id) ? ' on' : '')}>
                  <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} />
                  <span>{a.name}</span>
                  <strong>{fm(a.price)}</strong>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="readout total">
          <span>Total{addons.length ? ` (rest ${fm(restPrice)} + add-ons ${fm(addonsTotal(addons))})` : ''}</span>
          <strong>{fm(total)}</strong>
        </div>

        <PaymentBlock total={total} method={method} setMethod={setMethod} paid={paid} setPaid={setPaid} fm={fm} showErrors={tried} />

        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary big" disabled={tried && blocked}>Start timer</button>
        </div>
      </form>
    </Modal>
  );
}
