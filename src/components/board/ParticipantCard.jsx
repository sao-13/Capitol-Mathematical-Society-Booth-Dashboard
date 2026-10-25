import { memo } from 'react';
import { remainingMs, statusOf, formatClock, formatDuration } from '../../lib/timing.js';
import { formatMoney } from '../../lib/pricing.js';

// Each status has a colour AND a shape marker + text label, so it never relies on colour alone.
const STATUS = {
  green: { mark: '●', label: 'Resting' },
  amber: { mark: '▲', label: 'Ending soon' },
  expired: { mark: '■', label: "Time's up" },
  finished: { mark: '✓', label: 'Done' },
};

const clockTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function GuestCard({ s, now, settings, onExtend, onAddon, onPauseToggle, onEnd, onRemove, onDismiss }) {
  const status = statusOf(s, now, settings);
  const rem = remainingMs(s, now);
  const paused = !!s.pausedAt && status !== 'finished';
  const st = STATUS[status];
  const fm = (n) => formatMoney(n, settings.currency);
  const pct = Math.min(100, Math.max(0, (rem / s.durationMs) * 100));
  const live = status !== 'finished';
  const quick = settings.extensions;

  let sub;
  if (status === 'finished') sub = `Ended ${clockTime(s.endedAt)}`;
  else if (status === 'expired') sub = `Over by ${formatClock(-rem).slice(1)}`;
  else if (paused) sub = 'Paused';
  else sub = `Ends ${clockTime(now + rem)}`;

  return (
    <article className={`card ${status}${paused ? ' paused' : ''}${s.dismissed ? ' silenced' : ''}`} aria-label={`${s.name}, ${paused ? 'paused' : st.label}`}>
      <div className="card-top">
        <div className="who">
          <h3>{s.name}</h3>
          {s.station && <span className="station">Station {s.station}</span>}
        </div>
        <span className="status"><span aria-hidden="true">{paused ? '❚❚' : st.mark}</span> {paused ? 'Paused' : st.label}</span>
      </div>

      <div className="timer" role="timer" aria-label={`Time remaining for ${s.name}`}>
        {status === 'expired' ? '00:00' : formatClock(Math.max(0, rem))}
      </div>
      <div className="timer-sub">{sub} · {formatDuration(s.bookedMin ?? Math.round(s.durationMs / 60000))} booked</div>
      <div className="progress" aria-hidden="true"><i style={{ width: pct + '%' }} /></div>

      <div className="facts">
        <span>Paid <b>{fm(s.paid)}</b></span>
        <span>Price <b>{fm(s.price)}</b></span>
        <span>Change <b>{fm(s.change)}</b></span>
      </div>
      {s.addons?.length > 0 && (
        <ul className="tags" aria-label="Add-ons">
          {s.addons.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      )}

      {live ? (
        <>
          {status === 'expired' && !s.dismissed && (
            <button className="btn danger-solid wide" onClick={() => onDismiss(s.id)}>Silence alarm</button>
          )}
          <div className="extend-row">
            {quick.map((t) => (
              <button key={t.minutes} className="btn" onClick={() => onExtend(s.id, t.minutes)}>
                +{t.minutes} min <span className="btn-sub">{fm(t.price)}</span>
              </button>
            ))}
          </div>
          <div className="link-row">
            {status !== 'expired' && <button className="link" onClick={() => onPauseToggle(s.id)}>{paused ? 'Resume' : 'Pause'}</button>}
            {settings.addons.length > 0 && <button className="link" onClick={() => onAddon(s.id)}>Add-on</button>}
            <button className="link" onClick={() => onEnd(s.id)}>End</button>
            <button className="link danger" onClick={() => onRemove(s.id)}>Remove</button>
          </div>
        </>
      ) : (
        <div className="link-row">
          <button className="link danger" onClick={() => onRemove(s.id)}>Remove from board</button>
        </div>
      )}
    </article>
  );
}

export default memo(GuestCard);
