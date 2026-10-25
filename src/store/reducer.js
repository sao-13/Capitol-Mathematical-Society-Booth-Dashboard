import { pause, resume, extend } from '../lib/timing.js';
import { emptyData } from './storage.js';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** `undo` is kept in memory only (not persisted): the sessions list before the last end/remove. */
export function initState(data) {
  return { ...data, undo: null };
}

const mapById = (list, id, fn) => list.map((x) => (x.id === id ? fn(x) : x));

export function reducer(state, a) {
  switch (a.type) {
    case 'ADD_SESSION':
      return {
        ...state,
        sessions: [...state.sessions, a.session],
        transactions: [...state.transactions, a.transaction],
        guestCounter: a.usedGuest ? state.guestCounter + 1 : state.guestCounter,
      };
    case 'EXTEND': {
      const sessions = mapById(state.sessions, a.id, (s) => ({
        ...extend(s, a.minutes, a.now),
        bookedMin: (s.bookedMin ?? Math.round(s.durationMs / 60000)) + a.minutes,
        dismissed: false,
        ...(a.transaction
          ? {
              price: s.price + a.transaction.price,
              paid: s.paid + a.transaction.paid,
              change: s.change + a.transaction.change,
            }
          : {}),
      }));
      return {
        ...state,
        sessions,
        transactions: a.transaction ? [...state.transactions, a.transaction] : state.transactions,
      };
    }
    case 'ADDON_SALE':
      return {
        ...state,
        sessions: mapById(state.sessions, a.id, (s) => ({
          ...s,
          addons: [...(s.addons || []), ...a.names],
          price: s.price + a.transaction.price,
          paid: s.paid + a.transaction.paid,
          change: s.change + a.transaction.change,
        })),
        transactions: [...state.transactions, a.transaction],
      };
    case 'TOGGLE_PAUSE':
      return {
        ...state,
        sessions: mapById(state.sessions, a.id, (s) => (s.pausedAt ? resume(s, a.now) : pause(s, a.now))),
      };
    case 'DISMISS':
      return { ...state, sessions: mapById(state.sessions, a.id, (s) => ({ ...s, dismissed: true })) };
    case 'END':
      return {
        ...state,
        undo: { label: 'Session ended', sessions: state.sessions },
        sessions: mapById(state.sessions, a.id, (s) => ({ ...s, endedAt: a.now, pausedAt: null, dismissed: true })),
      };
    case 'REMOVE':
      return {
        ...state,
        undo: { label: 'Guest removed', sessions: state.sessions },
        sessions: state.sessions.filter((s) => s.id !== a.id),
      };
    case 'UNDO':
      return state.undo ? { ...state, sessions: state.undo.sessions, undo: null } : state;
    case 'CLEAR_UNDO':
      return { ...state, undo: null };

    case 'TX_ADD':
      return { ...state, transactions: [...state.transactions, a.row] };
    case 'TX_UPDATE':
      return { ...state, transactions: mapById(state.transactions, a.id, (t) => ({ ...t, ...a.patch })) };
    case 'TX_DELETE':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== a.id) };
    case 'EXP_ADD':
      return { ...state, expenses: [...state.expenses, a.row] };
    case 'EXP_UPDATE':
      return { ...state, expenses: mapById(state.expenses, a.id, (t) => ({ ...t, ...a.patch })) };
    case 'EXP_DELETE':
      return { ...state, expenses: state.expenses.filter((t) => t.id !== a.id) };

    case 'SETTINGS':
      return { ...state, settings: { ...state.settings, ...a.patch } };
    case 'IMPORT':
      return initState(a.data);
    case 'RESET':
      return initState(emptyData());
    default:
      return state;
  }
}
