import { useState } from 'react';
import { Modal, Segmented, PaymentBlock } from '../ui.jsx';
import { useStore, useNow } from '../../store/StoreProvider.jsx';
import { uid } from '../../store/reducer.js';
import { extensionQuote, validateAmount, formatMoney } from '../../lib/pricing.js';
import { remainingMs } from '../../lib/timing.js';

export default function ExtendDialog({ session, initialMinutes, onClose }) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const { settings } = state;
  const tiers = settings.extensions;
  const tierFor = (m) => tiers.find((t) => t.minutes === m) || tiers[0];
  const [tier, setTier] = useState(tierFor(initialMinutes));
  const [charge, setCharge] = useState(true);
  const [method, setMethod] = useState(session.method || 'cash');
  const [paid, setPaid] = useState(String(tier?.price ?? 0));
  const fm = (n) => formatMoney(n, settings.currency);

  const mins = tier?.minutes ?? 0;
  const q = extensionQuote(mins, Number(paid), settings);
  const paidErr = charge ? validateAmount(paid) : null;
  const blocked = !tier || !!paidErr || (charge && q.shortfall > 0);
  const overdue = remainingMs(session, now) < 0;

  const pick = (v) => {
    const t = tierFor(Number(v));
    setTier(t);
    setPaid(String(t.price));
  };

  const confirm = (e) => {
    e.preventDefault();
    if (blocked) return;
    dispatch({
      type: 'EXTEND',
      id: session.id,
      minutes: mins,
      now: Date.now(),
      transaction: charge
        ? {
            id: uid(), at: Date.now(), sessionId: session.id, participant: session.name, items: `Additional ${mins} min`,
            durationMin: mins, price: q.price, paid: Number(paid), change: q.change, method, notes: '',
          }
        : null,
    });
    onClose();
  };

  return (
    <Modal title={`Add time for ${session.name}`} onClose={onClose}>
      <form onSubmit={confirm} className="form">
        <div className="field">
          <span>Additional time</span>
          <Segmented label="Additional time" value={String(mins)} onChange={pick} options={tiers.map((t) => [String(t.minutes), `+${t.minutes} min`, fm(t.price)])} />
          {overdue && <p className="muted">Overdue time is not charged. The timer restarts with {mins} min from now.</p>}
        </div>

        <label className="check">
          <input type="checkbox" checked={charge} onChange={(e) => setCharge(e.target.checked)} />
          Charge for the additional time
        </label>

        {charge && (
          <>
            <div className="readout total"><span>Price</span><strong>{fm(q.price)}</strong></div>
            <PaymentBlock total={q.price} method={method} setMethod={setMethod} paid={paid} setPaid={setPaid} fm={fm} showErrors />
          </>
        )}

        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary big" disabled={blocked}>Add {mins} min</button>
        </div>
      </form>
    </Modal>
  );
}
