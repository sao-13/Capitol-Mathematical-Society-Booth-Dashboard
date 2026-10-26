// Shared dataset via Firebase Firestore.
// Layout: booths/{BOOTH_ID}                      -> { settings, guestCounter }
//         booths/{BOOTH_ID}/{sessions|transactions|expenses}/{id} -> one record each
// One document per record means two devices editing different guests never overwrite each other.
// Firestore's offline cache keeps the app working without internet and syncs when it's back.

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, writeBatch,
} from 'firebase/firestore';
import { firebaseConfig, BOOTH_ID } from '../firebase-config.js';

const COLS = ['sessions', 'transactions', 'expenses'];

let db = null;
function getDb() {
  if (db) return db;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app); // already initialised (e.g. dev hot reload)
  }
  return db;
}

/** JSON with sorted keys, so records compare equal regardless of field order. */
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  return JSON.stringify(v ?? null);
}

const mainOf = (s) => ({ settings: s.settings, guestCounter: s.guestCounter });

/**
 * Starts syncing. `dispatch` receives REMOTE / REMOTE_REPLACE actions; `onStatus` gets
 * 'connecting' | 'live' | 'offline' | 'error'. Returns { push(state), stop() }.
 */
export function startSync({ initial, dispatch, onStatus }) {
  const store = getDb();
  const root = doc(store, 'booths', BOOTH_ID);
  // What we believe the server holds (id -> stable JSON). Writes happen only where local state differs.
  const known = { sessions: new Map(), transactions: new Map(), expenses: new Map(), main: null };
  const remote = { sessions: new Map(), transactions: new Map(), expenses: new Map(), main: null, mainExists: false };
  const seen = new Set();
  let ready = false;
  let latest = initial;
  const fail = (err) => { console.error('Sync error', err); onStatus('error'); };

  function start() {
    if (ready || seen.size < COLS.length + 1) return;
    ready = true;
    if (!remote.mainExists) {
      push(latest); // first device to connect: upload what it has
    } else {
      dispatch({
        type: 'REMOTE_REPLACE',
        data: {
          ...remote.main,
          sessions: [...remote.sessions.values()],
          transactions: [...remote.transactions.values()],
          expenses: [...remote.expenses.values()],
        },
      });
    }
  }

  const unsubs = [
    onSnapshot(root, { includeMetadataChanges: true }, (snap) => {
      onStatus(snap.metadata.fromCache ? 'offline' : 'live');
      // Decide on first load only once the server has answered (or the cache has real data).
      if (!seen.has('main') && snap.metadata.fromCache && !snap.exists()) return;
      seen.add('main');
      remote.mainExists = snap.exists();
      if (snap.exists() && !snap.metadata.hasPendingWrites) {
        const data = snap.data();
        const j = stable(data);
        const changed = known.main !== j;
        remote.main = data;
        known.main = j;
        if (ready && changed) dispatch({ type: 'REMOTE', main: data });
      }
      start();
    }, fail),
    ...COLS.map((col) =>
      onSnapshot(collection(root, col), (snap) => {
        const upserts = [];
        const deletes = [];
        for (const ch of snap.docChanges()) {
          if (ch.doc.metadata.hasPendingWrites) continue; // our own write, already in local state
          const id = ch.doc.id;
          if (ch.type === 'removed') {
            remote[col].delete(id);
            if (known[col].delete(id)) deletes.push(id);
          } else {
            const data = ch.doc.data();
            const j = stable(data);
            remote[col].set(id, data);
            if (known[col].get(id) !== j) upserts.push(data);
            known[col].set(id, j);
          }
        }
        seen.add(col);
        if (ready && (upserts.length || deletes.length)) dispatch({ type: 'REMOTE', col, upserts, deletes });
        start();
      }, fail)
    ),
  ];

  function push(state) {
    latest = state;
    if (!ready) return;
    const ops = [];
    for (const col of COLS) {
      const ids = new Set();
      for (const rec of state[col]) {
        ids.add(rec.id);
        const j = stable(rec);
        if (known[col].get(rec.id) !== j) {
          ops.push((b) => b.set(doc(root, col, rec.id), rec));
          known[col].set(rec.id, j);
        }
      }
      for (const id of [...known[col].keys()]) {
        if (!ids.has(id)) {
          ops.push((b) => b.delete(doc(root, col, id)));
          known[col].delete(id);
        }
      }
    }
    const main = mainOf(state);
    const mj = stable(main);
    if (known.main !== mj) {
      ops.push((b) => b.set(root, main));
      known.main = mj;
    }
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(store);
      ops.slice(i, i + 450).forEach((op) => op(batch));
      batch.commit().catch(fail);
    }
  }

  return { push, stop: () => unsubs.forEach((u) => u()) };
}
