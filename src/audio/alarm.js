// Web Audio alarm sounds. Browsers only allow audio after the first user interaction,
// so unlockAudio() quietly starts the audio engine on the first tap/keypress anywhere.

export const SOUNDS = {
  tingting: 'Ting ting',
  chime: 'Chime',
  dingdong: 'Ding-dong',
  marimba: 'Marimba',
  musicbox: 'Music box',
  softbeep: 'Soft beep',
};
export const DEFAULT_SOUND = 'tingting';

let ctx = null;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  const unlock = () => {
    if (ensureCtx()?.state === 'running') {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    }
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/** A bell-like note: sine fundamental + a soft inharmonic overtone, quick attack, long decay. */
function bell(freq, start, vol, decay = 1.1) {
  for (const [mult, amp] of [[1, 1], [2.76, 0.25], [5.4, 0.08]]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * mult, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol * amp, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + decay / mult ** 0.5);
    o.connect(g).connect(ctx.destination);
    o.start(start);
    o.stop(start + decay + 0.1);
  }
}

function pluck(freq, start, vol, type = 'triangle', decay = 0.45) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  o.connect(g).connect(ctx.destination);
  o.start(start);
  o.stop(start + decay + 0.05);
}

const PATTERNS = {
  // ting ting! … ting ting!
  tingting: (t, v) => {
    bell(1760, t, v, 0.7);
    bell(1760, t + 0.17, v, 0.9);
    bell(1760, t + 0.75, v, 0.7);
    bell(1760, t + 0.92, v, 1.1);
  },
  chime: (t, v) => {
    bell(1047, t, v);
    bell(1319, t + 0.22, v);
    bell(1568, t + 0.44, v, 1.4);
  },
  dingdong: (t, v) => {
    bell(659, t, v, 1.2);
    bell(523, t + 0.55, v, 1.6);
  },
  marimba: (t, v) => {
    [784, 988, 1175, 1568].forEach((f, i) => pluck(f, t + i * 0.13, v, 'sine', 0.35));
    pluck(1568, t + 0.7, v, 'sine', 0.5);
  },
  musicbox: (t, v) => {
    [2093, 1568, 1760, 1319, 1568].forEach((f, i) => bell(f, t + i * 0.2, v * 0.8, 0.6));
  },
  softbeep: (t, v) => {
    pluck(880, t, v * 0.8, 'sine', 0.25);
    pluck(880, t + 0.35, v * 0.8, 'sine', 0.25);
  },
};

/** Plays one alarm cycle (~1.5s). Returns false if audio isn't available yet. */
export function playAlarm(kind = DEFAULT_SOUND, volume = 0.7) {
  if (!ensureCtx() || ctx.state !== 'running') return false;
  const v = Math.min(1, Math.max(0, volume)) * 0.5;
  (PATTERNS[kind] || PATTERNS[DEFAULT_SOUND])(ctx.currentTime + 0.02, Math.max(0.0002, v));
  return true;
}
