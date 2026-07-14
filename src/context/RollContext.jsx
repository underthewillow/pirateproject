import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { playDice, isMuted, setMuted } from '../lib/sound'
import { useData } from './DataContext'
import { useAppAuth } from './AuthContext'

const RollCtx = createContext(null)
export const useRoller = () => useContext(RollCtx)

const MAX_SHOWN = 200
function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Global roll toaster + shared roll log. Any roll anywhere in the app funnels
// through show(), which plays the dice sound, pops the animated overlay, and
// appends to the shared roll_log table (issue #23). The log itself lives in a
// side drawer that slides in automatically on each roll and can be dismissed.
export function RollProvider({ children }) {
  const { addItem, rolls, isDM, removeItem } = useData()
  const auth = useAppAuth()
  const [roll, setRoll] = useState(null)
  const [muted, setMutedState] = useState(isMuted())
  const [logOpen, setLogOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const timer = useRef(null)
  const counter = useRef(0)

  const show = useCallback((entry) => {
    setRoll({ ...entry, id: ++counter.current })
    playDice()
    setLogOpen(true) // pop the log drawer open on every roll (dismissible)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setRoll(null), 3400)
    // Persist to the shared roll log — fire-and-forget so a slow/failed write
    // never holds up the overlay. Records who rolled + enough to highlight
    // natural 20s and 1s later.
    const who = auth?.identity
    addItem?.('rolls', {
      roller: who?.displayName || 'Unknown hand',
      user_id: who?.id ?? null,
      label: entry.label || 'Roll',
      total: entry.total ?? null,
      detail: entry.detail ?? null,
      face: entry.face ?? null,
      crit: !!entry.crit,
      fumble: !!entry.fumble,
    }).catch((e) => console.error('roll log write failed', e))
  }, [addItem, auth])

  const toggleMute = () => { const v = !muted; setMuted(v); setMutedState(v) }

  // Escape closes the drawer.
  useEffect(() => {
    if (!logOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setLogOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [logOpen])

  // Newest first (stored oldest-first by created_at).
  const entries = [...(rolls || [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const shown = entries.slice(0, MAX_SHOWN)
  const clearAll = async () => {
    setConfirmClear(false)
    await Promise.all(entries.map((e) => removeItem('rolls', e.id)))
  }

  return (
    <RollCtx.Provider value={{ show }}>
      {children}

      {roll && (
        <div className="roll-overlay" key={roll.id} onClick={() => setRoll(null)}>
          <div className={`roll-card ${roll.crit ? 'crit' : ''} ${roll.fumble ? 'fumble' : ''}`}>
            <div className="roll-die">
              <svg viewBox="0 0 100 100" className="d20-svg" aria-hidden="true">
                <polygon points="50,4 92,28 92,72 50,96 8,72 8,28"
                  fill="rgba(255,250,235,0.12)" stroke="currentColor" strokeWidth="3" />
                <polygon points="50,4 92,28 50,50 8,28" fill="rgba(255,255,255,0.08)" />
                <polygon points="92,28 92,72 50,50" fill="rgba(0,0,0,0.10)" />
                <polygon points="8,28 8,72 50,50" fill="rgba(0,0,0,0.18)" />
              </svg>
              {roll.face != null && <span className="roll-face">{roll.face}</span>}
            </div>
            <div className="roll-info">
              <div className="roll-total">{roll.total}</div>
              <div className="roll-label">{roll.label}</div>
              {roll.detail && <div className="roll-detail">{roll.detail}</div>}
            </div>
          </div>
          <button
            className="roll-mute"
            onClick={(e) => { e.stopPropagation(); toggleMute() }}
            title={muted ? 'Unmute dice' : 'Mute dice'}
          >{muted ? '🔇' : '🔊'}</button>
        </div>
      )}

      {/* Pull tab + drawer only once someone's logged in (RollProvider also
          wraps the login screen, where a floating roll log makes no sense). */}
      {auth?.identity && (<>
      <button
        className={`rolllog-handle ${logOpen ? 'shift' : ''}`}
        onClick={() => setLogOpen((o) => !o)}
        title={logOpen ? 'Hide roll log' : 'Show roll log'}
        aria-label="Toggle roll log"
      >🎲</button>

      {/* Roll log drawer */}
      <aside className={`rolllog-drawer ${logOpen ? 'open' : ''}`} aria-hidden={!logOpen}>
        <div className="rolllog-drawer-head">
          <span className="rolllog-drawer-title">Roll Log</span>
          <button className="rolllog-drawer-close" onClick={() => setLogOpen(false)} aria-label="Close roll log">✕</button>
        </div>
        <div className="rolllog-drawer-body">
          {shown.length === 0 ? (
            <p className="muted" style={{ padding: '8px 4px' }}>No rolls yet — cast some dice and they'll appear here for the whole crew.</p>
          ) : (
            <div className="rolllog">
              {shown.map((e) => (
                <div key={e.id} className={`rolllog-row ${e.crit ? 'crit' : ''} ${e.fumble ? 'fumble' : ''}`}>
                  <div className="rolllog-total">{e.total ?? '—'}</div>
                  <div className="rolllog-main">
                    <div className="rolllog-label">
                      {e.label || 'Roll'}
                      {e.crit && <span className="rolllog-tag crit">NAT 20</span>}
                      {e.fumble && <span className="rolllog-tag fumble">NAT 1</span>}
                    </div>
                    {e.detail && <div className="rolllog-detail">{e.detail}</div>}
                    <div className="rolllog-sub">
                      <span className="rolllog-roller">{e.roller || 'Unknown hand'}</span>
                      <span className="rolllog-time">{formatTime(e.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {entries.length > MAX_SHOWN && (
                <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>
                  Showing the most recent {MAX_SHOWN} of {entries.length} rolls.
                </p>
              )}
            </div>
          )}
        </div>
        {isDM && entries.length > 0 && (
          <div className="rolllog-drawer-foot">
            {confirmClear ? (
              <>
                <button className="btn danger" onClick={clearAll}>Yes, clear all</button>
                <button className="btn" onClick={() => setConfirmClear(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn" onClick={() => setConfirmClear(true)}>Clear log</button>
            )}
          </div>
        )}
      </aside>
      </>)}
    </RollCtx.Provider>
  )
}
