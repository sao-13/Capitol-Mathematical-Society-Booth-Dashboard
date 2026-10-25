// The only module that touches localStorage. To move to a real database,
// replace load()/save() (and make them async) - nothing else needs to change.

import { SOUNDS, DEFAULT_SOUND } from '../audio/alarm.js';

const KEY = 'restbooth:v2';

export const DEFAULT_SETTINGS = {
  currency: '₱',
  baseMinutes: 30,
  basePrice: 20,
  extensions: [
    { minutes: 5, price: 5 },
    { minutes: 15, price: 10 },
  ],
  addons: [
    { id: 'boardgame', name: 'Board game access', price: 25 },
    { id: 'music', name: 'Music request (3 min)', price: 50 },
    { id: 'playlist', name: '1-hour playlist of choice', price: 100 },
  ],
  restOptions: 6, // rest-time buttons shown: 1 to 6 base blocks (30 min to 3 hr)
  amberPercent: 20,
  amberSeconds: 120,
  startingFloat: 0,
  alarmSound: DEFAULT_SOUND,
  volume: 0.7,
  muted: false,
};

export const emptyData = () => ({
  settings: structuredClone(DEFAULT_SETTINGS),
  sessions: [],
  transactions: [],
  expenses: [],
  guestCounter: 0,
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const d = JSON.parse(raw);
    const settings = { ...structuredClone(DEFAULT_SETTINGS), ...(d.settings || {}) };
    if (!SOUNDS[settings.alarmSound]) settings.alarmSound = DEFAULT_SOUND;
    delete settings.presets;
    return { ...emptyData(), ...d, settings };
  } catch {
    return emptyData();
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: keep running in memory */
  }
}

/** Full backup (settings, guests with their live timers, ledger, expenses) as a JSON string. */
export function toBackup(data) {
  return JSON.stringify({ app: 'rest-booth', version: 2, exportedAt: new Date().toISOString(), data }, null, 2);
}

/** Parse a backup file. Returns the data, or throws an Error with a readable message. */
export function fromBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a Rest Booth backup (it is not valid JSON).');
  }
  const d = parsed?.data;
  if (parsed?.app !== 'rest-booth' || !d || !Array.isArray(d.sessions) || !Array.isArray(d.transactions) || !Array.isArray(d.expenses)) {
    throw new Error('This file is not a Rest Booth backup.');
  }
  const settings = { ...structuredClone(DEFAULT_SETTINGS), ...(d.settings || {}) };
  if (!SOUNDS[settings.alarmSound]) settings.alarmSound = DEFAULT_SOUND;
  return { ...emptyData(), ...d, settings };
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
