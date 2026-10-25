import { useEffect } from 'react';
import { useStore } from '../store/StoreProvider.jsx';

export default function UndoToast() {
  const { state, dispatch } = useStore();
  const undo = state.undo;
  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => dispatch({ type: 'CLEAR_UNDO' }), 10000);
    return () => clearTimeout(id);
  }, [undo, dispatch]);
  if (!undo) return null;
  return (
    <div className="toast" role="status">
      <span>{undo.label}</span>
      <button className="link light" onClick={() => dispatch({ type: 'UNDO' })}>Undo</button>
    </div>
  );
}
