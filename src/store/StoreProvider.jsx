import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { reducer, initState } from './reducer.js';
import { load, save, clearAll } from './storage.js';

const StoreCtx = createContext(null);
const NowCtx = createContext(Date.now());

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => initState(load()));

  useEffect(() => {
    const { undo, ...persisted } = state;
    save(persisted);
  }, [state]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      reset: () => {
        clearAll();
        dispatch({ type: 'RESET' });
      },
    }),
    [state]
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
