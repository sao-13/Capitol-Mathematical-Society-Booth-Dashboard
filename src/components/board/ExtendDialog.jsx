import { useState } from 'react';
import { Modal, Segmented, PaymentBlock, MiscCharge, miscAmount, miscItem } from '../ui.jsx';
import { useStore, useNow } from '../../store/StoreProvider.jsx';
import { uid } from '../../store/reducer.js';
import { extensionQuote, changeFor, shortfallFor, round2, validateAmount, formatMoney } from '../../lib/pricing.js';
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
  const [misc, setMisc] = useState(null);
  const [tried, setTried] = useState(false);
  const fm = (n) => formatMoney(n, settings.currency);

  const mins = tier?.minutes ?? 0;
  const q = extensionQuote(mins, Number(paid), settings);
  const extra = miscAmount(misc);
  const price = round2((charge ? q.price : 0) + extra);
  const paying = charge || extra > 0;
  const paidErr = paying ? validateAmount(paid) : null;
  const blocked = !tier || (!!misc && !extra) || !!paidErr || (paying && shortfallFor(price, Number(paid)) > 0);
  const overdue = remainingMs(session, now) < 0;

  const pick = (v) => {
    const t = tierFor(Number(v));
    setTier(t);
    setPaid(String(t.price));
  };

  const confirm = (e) => {
    e.preventDefault();
    setTried(true);
    if (blocked) return;
    const items = [charge && `Additional ${mins} min`, extra && miscItem(misc)].filter(Boolean).join(' + ');
    dispatch({
      type: 'EXTEND',
      id: session.id,
      minutes: mins,
      now: Date.now(),
      transaction: paying
        ? {
            id: uid(), at: Date.now(), sessionId: session.id, participant: session.name, items,
            durationMin: charge ? mins : 0, price, paid: Number(paid), change: changeFor(price, Number(paid)), method, notes: '',
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

        <MiscCharge misc={misc} setMisc={setMisc} fm={fm} showErrors={tried || (!!misc && misc.amount !== '')} />

        {paying && (
          <>
            <div className="readout total">
              <span>{extra && charge ? `Price (time ${fm(q.price)} + ${misc.label.trim() || 'misc'} ${fm(extra)})` : 'Price'}</span>
              <strong>{fm(price)}</strong>
            </div>
            <PaymentBlock total={price} method={method} setMethod={setMethod} paid={paid} setPaid={setPaid} fm={fm} showErrors />
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
