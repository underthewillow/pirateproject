import { useState, useEffect } from 'react'
import { useData } from './context/DataContext'
import { useAppAuth } from './context/AuthContext'
import { TABS } from './config/tabs'
import LoginPage from './components/LoginPage'
import SettingsPage from './components/SettingsPage'
import HamburgerMenu from './components/common/HamburgerMenu'

// Remembers which tab/view was open across reloads — a plain page refresh
// (or a mobile browser reloading a backgrounded tab) would otherwise always
// dump you back to Home, regardless of how live the data sync feels.
const NAV_KEY = 'pcl_nav'
function loadNav() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_KEY))
    return {
      active: TABS.some((t) => t.key === saved?.active) ? saved.active : 'home',
      view: saved?.view === 'settings' ? 'settings' : 'app',
    }
  } catch {
    return { active: 'home', view: 'app' }
  }
}

export default function App() {
  const { loading, error, ship, canEdit } = useData()
  const { identity, authReady } = useAppAuth()
  const [active, setActive] = useState(() => loadNav().active)
  const [view, setView] = useState(() => loadNav().view)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(NAV_KEY, JSON.stringify({ active, view }))
  }, [active, view])

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

  const goToTab = (key) => { setActive(key); setView('app'); setMenuOpen(false) }

  return (
    <div className={`app ${canEdit ? 'can-edit' : ''}`}>
      <header className="masthead leather" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
        <button className="btn small" style={{ flex: '0 0 auto' }} title="Menu" onClick={() => setMenuOpen(true)}>☰</button>
        <div className="center" style={{ flex: '1 1 auto', minWidth: 0 }}>
          <h1 className="masthead-title">The Captain's Log</h1>
          <div className="masthead-sub">
            {ship?.name ? `— ${ship.name} —` : '— A Pirate Chronicle —'}
          </div>
        </div>
        <button className="btn small" style={{ flex: '0 0 auto', visibility: 'hidden' }} aria-hidden="true" tabIndex={-1}>☰</button>
      </header>

      {menuOpen && (
        <HamburgerMenu onClose={() => setMenuOpen(false)}>
          <div className="drawer-name">{identity.displayName}</div>
          <hr className="rule" />
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`drawer-item ${view === 'app' && active === t.key ? 'active' : ''}`}
              onClick={() => goToTab(t.key)}
            >
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
          <hr className="rule" />
          <button
            className={`drawer-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => { setView('settings'); setMenuOpen(false) }}
          >
            <span className="tab-icon">⚙</span>
            Settings
          </button>
        </HamburgerMenu>
      )}

      {view === 'settings' ? (
        <main className="parchment panel">
          <SettingsPage />
        </main>
      ) : (
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
            ActiveTab && <ActiveTab onNavigate={goToTab} />
          )}
        </main>
      )}

      <footer className="center muted" style={{ marginTop: 24, fontSize: 13, color: 'var(--parchment-dark)' }}>
        Changes save automatically and appear for the whole crew.
      </footer>
    </div>
  )
}
