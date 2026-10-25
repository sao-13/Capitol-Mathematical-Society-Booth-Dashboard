import { useEffect, useMemo } from 'react';
import { useStore, useNow } from '../../store/StoreProvider.jsx';
import { statusOf } from '../../lib/timing.js';
import { playAlarm } from '../../audio/alarm.js';

const TITLE = 'Rest Booth';

/** Repeats the alarm sound while any guest is overdue and not silenced, and flags the browser tab title.
 *  The visual alert itself lives on the guest's card. */
export default function AlarmManager() {
  const { state } = useStore();
  const now = useNow();
  const { sessions, settings } = state;

  const alarming = useMemo(
    () => sessions.filter((s) => !s.dismissed && statusOf(s, now, settings) === 'expired'),
    [sessions, now, settings]
  );
  const active = alarming.length > 0;

  useEffect(() => {
    if (!active || settings.muted) return;
    playAlarm(settings.alarmSound, settings.volume);
    const id = setInterval(() => playAlarm(settings.alarmSound, settings.volume), 2400);
    return () => clearInterval(id);
  }, [active, settings.muted, settings.alarmSound, settings.volume]);

  const names = alarming.map((s) => s.name).join(', ');
  useEffect(() => {
    document.title = names ? `Time's up: ${names} · ${TITLE}` : TITLE;
  }, [names]);

  return null;
}
