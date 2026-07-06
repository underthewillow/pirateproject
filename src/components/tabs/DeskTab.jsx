import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { assetUrl } from '../../lib/asset'
import Editable from '../common/Editable'
import { HANDBOOK, DIAGRAMS } from '../../data/handbook'

// Interactive diagram (points-of-sail wheel / arc of fire): the real art with
// tap-able hotspots that explain each sector.
function Diagram({ which }) {
  const d = DIAGRAMS[which]
  const [active, setActive] = useState(null)
  if (!d) return null
  const cap = active != null ? d.spots[active].text : d.caption
  return (
    <div className="hb-diagram">
      <div className="hb-diagram-img">
        <img src={assetUrl('desk/' + d.img)} alt="" />
        {d.spots.map((s, i) => (
          <button
            key={i}
            className={`hb-spot ${active === i ? 'on' : ''}`}
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            aria-label={s.label}
          />
        ))}
      </div>
      <div className={`hb-diagram-cap ${active != null ? 'live' : ''}`}>{cap}</div>
    </div>
  )
}

export default function DeskTab() {
  const { settings, setSetting, canEdit, isDM } = useData()
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)

  const revealed = Array.isArray(settings?.handbook_revealed) ? settings.handbook_revealed : []
  const isShown = (id) => revealed.includes(id)

  // DM sees every chapter; the crew see only what's been revealed.
  const chapters = isDM ? HANDBOOK : HANDBOOK.filter((c) => isShown(c.id))
  const safeIdx = Math.min(idx, Math.max(0, chapters.length - 1))
  const ch = chapters[safeIdx]

  const go = (n) => setIdx(() => (n + chapters.length) % chapters.length)

  const toggleReveal = (id) => {
    const next = isShown(id) ? revealed.filter((r) => r !== id) : [...revealed, id]
    setSetting('handbook_revealed', next)
  }
  const revealAll = () => setSetting('handbook_revealed', HANDBOOK.map((c) => c.id))
  const hideAll = () => setSetting('handbook_revealed', [])

  return (
    <div>
      <h2 className="section-title">Captain Ruby Tooth's Desk</h2>
      <p className="muted" style={{ marginTop: 0 }}>The ship's log, and the captain's handbook of sailing &amp; battle.</p>

      {/* ---- Sailing Log ---- */}
      <div className="sb-section-title">Sailing Log</div>
      <div className="card journal-body" style={{ whiteSpace: 'pre-wrap' }}>
        <Editable
          as="div"
          multiline
          placeholder="Record the voyage — headings, weather, ports, and hard-won lessons…"
          value={settings?.sailing_log || ''}
          onCommit={(v) => setSetting('sailing_log', v)}
        />
      </div>
      {!canEdit && <p className="muted" style={{ fontSize: 13 }}>You'll need admin or DM access to add to the log.</p>}

      {/* ---- The Captain's Handbook ---- */}
      <div className="row-between" style={{ marginTop: 24, alignItems: 'flex-end' }}>
        <div className="sb-section-title" style={{ margin: 0, border: 'none' }}>The Captain's Handbook</div>
        {isDM && (
          <div className="flex gap-sm">
            <button className="btn small ghost" onClick={revealAll}>Reveal all</button>
            <button className="btn small ghost" onClick={hideAll}>Hide all</button>
          </div>
        )}
      </div>
      <hr className="rule" style={{ marginTop: 6 }} />

      {isDM && (
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          🧭 DM view — you see every chapter. Use the <strong>reveal</strong> toggle on each to share it with the crew; they only see what you've revealed.
        </p>
      )}

      {chapters.length === 0 ? (
        <div className="card center" style={{ padding: '28px 18px' }}>
          <div style={{ fontSize: 34, opacity: 0.5 }}>📕</div>
          <p className="muted" style={{ margin: '8px 0 0' }}>The captain hasn't opened the handbook yet. New lessons will appear here as they're taught.</p>
        </div>
      ) : !open ? (
        // Closed book — a leather-bound cover; click to open
        <button className="hb-closed" onClick={() => setOpen(true)}>
          <span className="hb-closed-frame">
            <span className="hb-closed-emblem">☠</span>
            <span className="hb-closed-title">The Captain's Handbook</span>
            <span className="hb-closed-frule" />
            <span className="hb-closed-sub">Sailing &amp; Naval Combat</span>
            <span className="hb-closed-count">{chapters.length} chapter{chapters.length === 1 ? '' : 's'}</span>
            <span className="hb-closed-open">Open the book ›</span>
          </span>
        </button>
      ) : (
        <div className="handbook">
          {/* contents rail */}
          <div className="hb-toc">
            {chapters.map((c, i) => (
              <button key={c.id} className={`hb-toc-item ${i === safeIdx ? 'on' : ''}`} onClick={() => setIdx(i)}>
                <span className="hb-toc-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="hb-toc-title">{c.title}</span>
                {isDM && (
                  <span
                    role="button"
                    tabIndex={0}
                    className={`hb-eye ${isShown(c.id) ? 'shown' : 'hidden'}`}
                    title={isShown(c.id) ? 'Revealed to crew — click to hide' : 'Hidden from crew — click to reveal'}
                    onClick={(e) => { e.stopPropagation(); toggleReveal(c.id) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggleReveal(c.id) } }}
                  >{isShown(c.id) ? '👁' : '🚫'}</span>
                )}
              </button>
            ))}
          </div>

          {/* the open spread */}
          <div className="hb-book">
            <div className="hb-spread" key={ch.id}>
              <div className="hb-page hb-left">
                {ch.diagram
                  ? <Diagram which={ch.diagram} />
                  : <img className="hb-illus" src={assetUrl('desk/' + (ch.art || 'ship.jpg'))} alt="" />}
                <div className="hb-chapno">Chapter {String(safeIdx + 1).padStart(2, '0')} of {String(chapters.length).padStart(2, '0')}</div>
              </div>

              <div className="hb-page hb-right">
                {isDM && (
                  <button className={`hb-reveal ${isShown(ch.id) ? 'shown' : ''}`} onClick={() => toggleReveal(ch.id)}>
                    {isShown(ch.id) ? '👁 Revealed to crew' : '🚫 Hidden — reveal to crew'}
                  </button>
                )}
                <h3 className="hb-title">{ch.title}</h3>
                <p className="hb-lead">{ch.lead}</p>
                <div className="hb-body">
                  {ch.body.map((b, j) =>
                    typeof b === 'string'
                      ? <p key={j}>{b}</p>
                      : <p key={j} className="hb-def"><strong>{b.t}.</strong> {b.d}</p>
                  )}
                </div>
              </div>
            </div>

            {/* nav */}
            <div className="hb-nav">
              <button className="btn small" onClick={() => go(safeIdx - 1)}>‹ Prev</button>
              <span className="hb-dots">
                {chapters.map((c, i) => (
                  <span key={c.id} className={`hb-dot ${i === safeIdx ? 'on' : ''}`} onClick={() => setIdx(i)} />
                ))}
              </span>
              <button className="btn small" onClick={() => go(safeIdx + 1)}>Next ›</button>
              <button className="btn small ghost hb-close" onClick={() => setOpen(false)}>Close book</button>
            </div>
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        Rules digested from <em>Limithron's Guide to Naval Combat</em> (free edition); cover art <em>The Battle of Trafalgar</em>, public domain.
      </p>
    </div>
  )
}
