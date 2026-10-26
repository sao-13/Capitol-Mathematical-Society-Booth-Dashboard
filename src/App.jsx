import { useCallback, useState } from 'react';
import { StoreProvider, useStore } from './store/StoreProvider.jsx';
import BoothBoard from './components/board/BoothBoard.jsx';
import FinanceSheet from './components/finance/FinanceSheet.jsx';
import AlarmManager from './components/board/AlarmManager.jsx';
import ExtendDialog from './components/board/ExtendDialog.jsx';
import AddonDialog from './components/board/AddonDialog.jsx';
import Settings from './components/Settings.jsx';
import UndoToast from './components/UndoToast.jsx';

function Shell() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState('board');
  const [showSettings, setShowSettings] = useState(false);
  const [extend, setExtend] = useState(null); // { id, minutes }
  const [addonFor, setAddonFor] = useState(null);
  const { settings } = state;

  const openExtend = useCallback((id, minutes) => setExtend({ id, minutes }), []);
  const openAddon = useCallback((id) => setAddonFor(id), []);
  const extending = extend && state.sessions.find((s) => s.id === extend.id);
  const selling = addonFor && state.sessions.find((s) => s.id === addonFor);

  return (
    <>
      <header className="topbar no-print">
        <div className="brand">Rest Booth</div>
        <nav role="tablist" aria-label="Sections">
          <button role="tab" aria-selected={tab === 'board'} className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>Booth Board</button>
          <button role="tab" aria-selected={tab === 'finance'} className={tab === 'finance' ? 'on' : ''} onClick={() => setTab('finance')}>Finance Sheet</button>
        </nav>
        <div className="tools">
          <SyncStatus />
          <button className={'btn small' + (settings.muted ? ' attention' : '')} aria-pressed={settings.muted} onClick={() => dispatch({ type: 'SETTINGS', patch: { muted: !settings.muted } })}>
            {settings.muted ? 'Alarm muted · Unmute' : 'Mute alarm'}
          </button>
          <button className="btn small" onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      </header>

      <AlarmManager />

      <main>
        {tab === 'board' ? <BoothBoard onExtend={openExtend} onAddon={openAddon} /> : <FinanceSheet />}
      </main>

      {extending && <ExtendDialog session={extending} initialMinutes={extend.minutes} onClose={() => setExtend(null)} />}
      {selling && <AddonDialog session={selling} onClose={() => setAddonFor(null)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      <UndoToast />
    </>
  );
}

const SYNC_LABELS = {
  off: ['local', 'This device only'],
  connecting: ['wait', 'Connecting…'],
  live: ['live', 'Shared · live'],
  offline: ['wait', 'Offline · will sync'],
  error: ['bad', 'Sync problem'],
};

function SyncStatus() {
  const { cloud } = useStore();
  const [kind, label] = SYNC_LABELS[cloud];
  const tip = {
    off: 'Data is saved in this browser only. Fill in src/firebase-config.js to share data between devices.',
    connecting: 'Connecting to the shared database.',
    live: 'All devices see the same guests, timers and finances.',
    offline: 'No internet. Keep working; changes sync automatically when the connection is back.',
    error: 'Could not reach the shared database. Check the Firebase setup and security rules.',
  }[cloud];
  return <span className={`sync ${kind}`} title={tip} role="status"><i aria-hidden="true" />{label}</span>;
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
