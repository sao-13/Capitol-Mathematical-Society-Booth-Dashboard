import { useEffect, useRef, useState } from 'react';

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Runs once per open: focus the intended field (never the close button) and restore focus on close.
  useEffect(() => {
    const prev = document.activeElement;
    const root = ref.current;
    const target = root?.querySelector('[data-autofocus]') || root?.querySelector('.modal-body input, .modal-body select, .modal-body button');
    target?.focus();
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="row end">
        <button className="btn" onClick={onCancel} data-autofocus>Cancel</button>
        <button className={'btn ' + (danger ? 'danger-solid' : 'primary')} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

/** Text/number/datetime input that keeps a local draft and commits on blur or Enter. */
export function CommitInput({ value, onCommit, parse = (v) => v, format = (v) => String(v ?? ''), ...rest }) {
  const [draft, setDraft] = useState(format(value));
  useEffect(() => setDraft(format(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const parsed = parse(draft);
    if (parsed === undefined) setDraft(format(value));
    else if (JSON.stringify(parsed) !== JSON.stringify(value)) onCommit(parsed);
  };
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(format(value));
      }}
    />
  );
}

export const parseMoney = (v) => {
  const n = Number(v);
  return v.trim() === '' || Number.isNaN(n) || n < 0 ? undefined : Math.round(n * 100) / 100;
};

/** Segmented choice (single select). options: [[value, label, sublabel?]] */
export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l, sub]) => (
        <button type="button" key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          <span>{l}</span>
          {sub && <small>{sub}</small>}
        </button>
      ))}
    </div>
  );
}

/** Amount paid + quick cash buttons + change/shortfall readout. */
export function PaymentBlock({ total, method, setMethod, paid, setPaid, fm, showErrors }) {
  const n = Number(paid);
  const invalid = paid === '' || Number.isNaN(n) || n < 0;
  const short = invalid ? 0 : Math.max(0, total - n);
  const change = invalid ? 0 : Math.max(0, n - total);
  const quick = [...new Set([total, 50, 100, 200, 500, 1000])].filter((x) => x >= total && x > 0).slice(0, 5);
  return (
    <div className="pay">
      <Segmented label="Payment method" value={method} onChange={setMethod} options={[['cash', 'Cash'], ['card', 'Card'], ['other', 'Other']]} />
      <label className="field">
        <span>Amount received</span>
        <input type="number" min="0" step="0.01" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" />
      </label>
      {total > 0 && (
        <div className="quick">
          {quick.map((x) => (
            <button type="button" key={x} className="btn small" onClick={() => setPaid(String(x))}>{x === total ? 'Exact' : fm(x)}</button>
          ))}
        </div>
      )}
      {!invalid && short > 0 && <p className="err" role="alert">Short by {fm(short)}. Collect the full amount to continue.</p>}
      {showErrors && invalid && <p className="err" role="alert">{paid !== '' && n < 0 ? 'Amount cannot be negative.' : 'Enter the amount received.'}</p>}
      <div className={'readout' + (!invalid && short === 0 && total > 0 ? ' good' : '')}>
        <span>Change</span>
        <strong>{fm(change)}</strong>
      </div>
    </div>
  );
}

/** Misc charge value helpers. `misc` is null (hidden) or { label, amount } as typed strings. */
export const miscAmount = (misc) => (misc && Number(misc.amount) > 0 ? Math.round(Number(misc.amount) * 100) / 100 : 0);
export const miscLabel = (misc) => (misc?.label.trim() || 'Misc charge');
export const miscItem = (misc) => `Misc: ${miscLabel(misc)}`;

/** Optional one-off charge with a custom label and amount. */
export function MiscCharge({ misc, setMisc, fm, showErrors }) {
  if (!misc) {
    return (
      <button type="button" className="misc-add" onClick={() => setMisc({ label: '', amount: '' })}>
        <span aria-hidden="true">+</span> Add miscellaneous charge
      </button>
    );
  }
  const bad = showErrors && !(Number(misc.amount) > 0);
  return (
    <div className="misc" role="group" aria-label="Miscellaneous charge">
      <div className="misc-head">
        <strong>Miscellaneous charge</strong>
        <button type="button" className="link danger" onClick={() => setMisc(null)}>Remove</button>
      </div>
      <div className="cols">
        <label className="field grow">
          <span>Label</span>
          <input value={misc.label} onChange={(e) => setMisc({ ...misc, label: e.target.value })} placeholder="e.g. Charging fee, Water, Late fee" autoComplete="off" data-autofocus />
        </label>
        <label className="field narrow">
          <span>Amount</span>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={misc.amount} onChange={(e) => setMisc({ ...misc, amount: e.target.value })} placeholder="0" aria-invalid={bad || undefined} />
        </label>
      </div>
      {bad && <p className="err" role="alert">Enter an amount greater than 0, or remove this charge.</p>}
    </div>
  );
}
