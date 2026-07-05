import { useState } from 'react'
import { useData } from './context/DataContext'
import { useAppAuth } from './context/AuthContext'
import { TABS } from './config/tabs'
import LoginPage from './components/LoginPage'
import SettingsPage from './components/SettingsPage'

export default function App() {
  const { loading, error, ship, canEdit } = useData()
  const { identity, authReady } = useAppAuth()
  const [active, setActive] = useState('home')
  const [view, setView] = useState('app')

  const ActiveTab = TABS.find((t) => t.key === active)?.component

  if (!authReady || !identity) {
    return (
      <div className="app">
        <header className="masthead leather">
          <div>
            <h1 className="masthead-title">The Captain's Log</h1>
            <div className="masthead-sub">— A Pirate Chronicle —</div>
          </div>
        </header>
        <main className="panel">
          {authReady ? <LoginPage /> : <div className="spinner">Casting off…</div>}
        </main>
      </div>
    )
  }

  return (
    <div className={`app ${canEdit ? 'can-edit' : ''}`}>
      <header className="masthead leather">
        <div>
          <h1 className="masthead-title">The Captain's Log</h1>
          <div className="masthead-sub">
            {ship?.name ? `— ${ship.name} —` : '— A Pirate Chronicle —'}
          </div>
        </div>
        <div className="toolbar">
          <span className="eyebrow" style={{ color: 'var(--brass-light)' }}>{identity.displayName}</span>
          <button
            className="btn small"
            title={view === 'settings' ? 'Back to the Helm' : 'Settings'}
            onClick={() => setView(view === 'settings' ? 'app' : 'settings')}
          >
            {view === 'settings' ? '🏴‍☠️' : '⚙'}
          </button>
        </div>
      </header>

      {view === 'settings' ? (
        <main className="parchment panel">
          <SettingsPage />
        </main>
      ) : (
        <>
          <nav className="tabbar">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab ${active === t.key ? 'active' : ''}`}
                onClick={() => setActive(t.key)}
              >
                <span className="tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          <main className="parchment panel">
            {loading ? (
              <div className="spinner">Unfurling the charts…</div>
            ) : error ? (
              <div className="center" style={{ padding: 40 }}>
                <div className="seal" style={{ margin: '0 auto 12px', background: 'radial-gradient(circle at 35% 30%, #b8453c, var(--wax-red))' }}>!</div>
                <h2 className="section-title">The log won't open</h2>
                <p className="muted">{error}</p>
              </div>
            ) : (
              ActiveTab && <ActiveTab onNavigate={setActive} />
            )}
          </main>
        </>
      )}

      <footer className="center muted" style={{ marginTop: 24, fontSize: 13, color: 'var(--parchment-dark)' }}>
        Changes save automatically and appear for the whole crew.
      </footer>
    </div>
  )
}
