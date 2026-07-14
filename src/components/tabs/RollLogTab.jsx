import { useState } from 'react'
import { useData } from '../../context/DataContext'

// A shared, live-synced record of every dice roll in the app (issue #23).
// Rolls are appended by RollContext.show(); here we just present them newest
// first, note who rolled, and highlight natural 20s and natural 1s.
const MAX_SHOWN = 200

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function RollLogTab() {
  const { rolls, isDM, removeItem } = useData()
  const [confirmClear, setConfirmClear] = useState(false)

  // Newest first (the array is stored oldest-first by created_at).
  const entries = [...(rolls || [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const shown = entries.slice(0, MAX_SHOWN)

  const clearAll = async () => {
    setConfirmClear(false)
    await Promise.all(entries.map((e) => removeItem('rolls', e.id)))
  }

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 2 }}>The Roll Log</h2>
          <p className="map-tagline">Every die cast aboard, and by whose hand.</p>
        </div>
        {isDM && entries.length > 0 && (
          confirmClear ? (
            <div className="toolbar">
              <button className="btn danger" onClick={clearAll}>Yes, clear all</button>
              <button className="btn" onClick={() => setConfirmClear(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn" onClick={() => setConfirmClear(true)}>Clear log</button>
          )
        )}
      </div>

      {shown.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>No rolls yet — cast some dice and they'll appear here for the whole crew to see.</p>
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
              </div>
              <div className="rolllog-meta">
                <div className="rolllog-roller">{e.roller || 'Unknown hand'}</div>
                <div className="rolllog-time">{formatTime(e.created_at)}</div>
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
  )
}
