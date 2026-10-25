// Timers are derived from timestamps, never from counting ticks.
// session: { startedAt, durationMs, pausedAt (ms|null), pausedMs, endedAt (ms|null) }

export function elapsedMs(s, now) {
  const ref = s.endedAt ?? s.pausedAt ?? now;
  return Math.max(0, ref - s.startedAt - s.pausedMs);
}

export function remainingMs(s, now) {
  return s.durationMs - elapsedMs(s, now);
}

/** 'finished' | 'expired' | 'amber' | 'green' (pause is a separate flag). */
export function statusOf(s, now, { amberPercent = 20, amberSeconds = 120 } = {}) {
  if (s.endedAt) return 'finished';
  const rem = remainingMs(s, now);
  if (rem <= 0) return 'expired';
  const threshold = Math.max((s.durationMs * amberPercent) / 100, amberSeconds * 1000);
  return rem < threshold ? 'amber' : 'green';
}

/** Add time. If the guest's time is up, the overdue time is ignored completely: the timer starts
 *  fresh from now with just the added minutes (full progress bar, normal colour thresholds). */
export function extend(s, minutes, now) {
  const add = minutes * 60000;
  if (!s.endedAt && remainingMs(s, now) <= 0) {
    return { ...s, startedAt: now, pausedAt: null, pausedMs: 0, durationMs: add };
  }
  return { ...s, durationMs: s.durationMs + add };
}

/** 30 -> "30 min", 60 -> "1 hr", 90 -> "1 hr 30 min" */
export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function pause(s, now) {
  return s.pausedAt ? s : { ...s, pausedAt: now };
}

export function resume(s, now) {
  if (!s.pausedAt) return s;
  return { ...s, pausedAt: null, pausedMs: s.pausedMs + (now - s.pausedAt) };
}

/** mm:ss or h:mm:ss; a negative value (overtime) gets a leading '+'. */
export function formatClock(ms) {
  const over = ms < 0;
  const total = over ? Math.floor(Math.abs(ms) / 1000) : Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const body = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  return over ? '+' + body : body;
}
