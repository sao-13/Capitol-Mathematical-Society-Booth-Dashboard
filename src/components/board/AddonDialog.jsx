import { useState } from 'react';
import { Modal, PaymentBlock } from '../ui.jsx';
import { useStore } from '../../store/StoreProvider.jsx';
import { uid } from '../../store/reducer.js';
import { addonsTotal, changeFor, shortfallFor, validateAmount, formatMoney } from '../../lib/pricing.js';

/** Sell add-ons (board game, music request, playlist…) to a guest who is already resting. */
export default function AddonDialog({ session, onClose }) {
  const { state, dispatch } = useStore();
  const { settings } = state;
  const [picked, setPicked] = useState([]);
  const [method, setMethod] = useState(session.method || 'cash');
  const [paid, setPaid] = useState('');
  const [tried, setTried] = useState(false);
  const fm = (n) => formatMoney(n, settings.currency);

  const addons = settings.addons.filter((a) => picked.includes(a.id));
  const total = addonsTotal(addons);
  const blocked = !addons.length || !!validateAmount(paid) || shortfallFor(total, Number(paid)) > 0;
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const confirm = (e) => {
    e.preventDefault();
    setTried(true);
    if (blocked) return;
    dispatch({
      type: 'ADDON_SALE',
      id: session.id,
      names: addons.map((a) => a.name),
      transaction: {
        id: uid(), at: Date.now(), sessionId: session.id, participant: session.name, items: addons.map((a) => a.name).join(' + '),
        durationMin: 0, price: total, paid: Number(paid), change: changeFor(total, Number(paid)), method, notes: '',
      },
    });
    onClose();
  };

  return (
    <Modal title={`Add-ons for ${session.name}`} onClose={onClose}>
      <form onSubmit={confirm} className="form">
        <div className="addon-list">
          {settings.addons.map((a, i) => (
            <label key={a.id} className={'addon' + (picked.includes(a.id) ? ' on' : '')}>
              <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} data-autofocus={i === 0 ? true : undefined} />
              <span>{a.name}</span>
              <strong>{fm(a.price)}</strong>
            </label>
          ))}
        </div>
        {tried && !addons.length && <p className="err" role="alert">Pick at least one add-on.</p>}
        <div className="readout total"><span>Total</span><strong>{fm(total)}</strong></div>
        <PaymentBlock total={total} method={method} setMethod={setMethod} paid={paid} setPaid={setPaid} fm={fm} showErrors={tried} />
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary big" disabled={tried && blocked}>Charge {fm(total)}</button>
        </div>
      </form>
    </Modal>
  );
}
