import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { reducer, initState } from './reducer.js';
import { load, save, clearAll } from './storage.js';
import { cloudEnabled } from '../firebase-config.js';

const StoreCtx = createContext(null);
const NowCtx = createContext(Date.now());

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => initState(load()));
  // 'off' (local only) | 'connecting' | 'live' | 'offline' | 'error'
  const [cloud, setCloud] = useState(cloudEnabled ? 'connecting' : 'off');
  const syncRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Shared dataset: Firebase is loaded only when configured (see src/firebase-config.js).
  useEffect(() => {
    if (!cloudEnabled) return;
    let stopped = false;
    let sync = null;
    import('./cloud.js')
      .then(({ startSync }) => {
        if (stopped) return;
        sync = startSync({ initial: stateRef.current, dispatch, onStatus: setCloud });
        syncRef.current = sync;
      })
      .catch((err) => {
        console.error(err);
        setCloud('error');
      });
    return () => {
      stopped = true;
      sync?.stop();
      syncRef.current = null;
    };
  }, []);

  useEffect(() => {
    const { undo, ...persisted } = state;
    save(persisted); // local copy, also used when offline or not configured
    syncRef.current?.push(state);
  }, [state]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      cloud,
      reset: () => {
        clearAll();
        dispatch({ type: 'RESET' });
      },
    }),
    [state, cloud]
  );

  return (
    <StoreCtx.Provider value={value}>
      <Clock>{children}</Clock>
    </StoreCtx.Provider>
  );
}

/** One shared 1s ticker for the whole app. Time itself comes from timestamps, so a throttled
 *  background tab is corrected the moment it ticks or becomes visible again. */
function Clock({ children }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return <NowCtx.Provider value={now}>{children}</NowCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
export const useNow = () => useContext(NowCtx);
