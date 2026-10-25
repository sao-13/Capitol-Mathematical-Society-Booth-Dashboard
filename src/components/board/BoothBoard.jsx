import { useMemo, useState } from 'react';
import GuestCard from './ParticipantCard.jsx';
import SummaryBar from './SummaryBar.jsx';
import AddGuestPanel from './AddGuestPanel.jsx';
import { Segmented } from '../ui.jsx';
import { useStore, useNow } from '../../store/StoreProvider.jsx';
import { remainingMs, statusOf } from '../../lib/timing.js';

const FILTERS = [['all', 'All'], ['active', 'Resting'], ['expired', "Time's up"], ['finished', 'Done']];

export default function BoothBoard({ onExtend, onAddon }) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const { settings, sessions } = state;
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sessions
      .map((s) => ({ s, status: statusOf(s, now, settings), rem: remainingMs(s, now) }))
      .filter(({ s, status }) => {
        if (q && !(s.name.toLowerCase().includes(q) || String(s.station).toLowerCase().includes(q))) return false;
        if (filter === 'active') return status === 'green' || status === 'amber';
        if (filter === 'expired') return status === 'expired';
        if (filter === 'finished') return status === 'finished';
        return true;
      });
    // Closest to finishing on top (overdue guests first, since they need attention); done guests at the bottom.
    const fin = (r) => (r.status === 'finished' ? 1 : 0);
    list.sort((a, b) => fin(a) - fin(b) || (fin(a) ? b.s.endedAt - a.s.endedAt : a.rem - b.rem));
    return list;
  }, [sessions, now, settings, query, filter]);

  const handlers = useMemo(
    () => ({
      onExtend,
      onAddon,
      onPauseToggle: (id) => dispatch({ type: 'TOGGLE_PAUSE', id, now: Date.now() }),
      onEnd: (id) => dispatch({ type: 'END', id, now: Date.now() }),
      onRemove: (id) => dispatch({ type: 'REMOVE', id }),
      onDismiss: (id) => dispatch({ type: 'DISMISS', id }),
    }),
    [dispatch, onExtend, onAddon]
  );

  return (
    <section aria-label="Booth Board" className="board">
      <div className="board-head">
        <SummaryBar />
        <button className="btn primary big" onClick={() => setAdding(true)}>New guest</button>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Search name or station" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search guests" />
        <Segmented label="Filter" value={filter} onChange={setFilter} options={FILTERS} />
        <span className="muted sort">Closest to finishing first</span>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          {sessions.length === 0 ? (
            <>
              <p>No guests yet.</p>
              <button className="btn primary big" onClick={() => setAdding(true)}>Add the first guest</button>
            </>
          ) : (
            <p>No guests match this search or filter.</p>
          )}
        </div>
      ) : (
        <div className="cards">
          {rows.map(({ s }) => (
            <GuestCard key={s.id} s={s} now={now} settings={settings} {...handlers} />
          ))}
        </div>
      )}

      {adding && <AddGuestPanel onClose={() => setAdding(false)} />}
    </section>
  );
}
