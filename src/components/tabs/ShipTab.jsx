import { useData } from '../../context/DataContext'
import Editable from '../common/Editable'

export default function ShipTab() {
  const { ship, patchSingleton, canEdit } = useData()
  if (!ship) return <p className="muted">No ship on record.</p>

  const stats = Array.isArray(ship.stats) ? ship.stats : []
  const upgrades = Array.isArray(ship.upgrades) ? ship.upgrades : []

  const setStats = (next) => patchSingleton('ship', { stats: next })
  const setUpgrades = (next) => patchSingleton('ship', { upgrades: next })

  return (
    <div className="panel-grid" style={{ gridTemplateColumns: 'minmax(260px, 1fr) 1.3fr', alignItems: 'start' }}>
      {/* Portrait + identity */}
      <div>
        <div
          className="card"
          style={{
            aspectRatio: '4/3',
            display: 'grid',
            placeItems: 'center',
            backgroundImage: ship.image_url ? `url(${ship.image_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            overflow: 'hidden',
          }}
        >
          {!ship.image_url && <span className="muted center">⛵<br />Add a portrait of the ship</span>}
        </div>
        {canEdit && (
          <div style={{ marginTop: 8 }}>
            <label className="eyebrow">Ship image URL</label>
            <Editable
              value={ship.image_url}
              placeholder="paste an image link"
              onCommit={(v) => patchSingleton('ship', { image_url: v })}
            />
          </div>
        )}
        <h2 className="section-title" style={{ marginTop: 14 }}>
          <Editable value={ship.name} onCommit={(v) => patchSingleton('ship', { name: v })} />
        </h2>
        <Editable
          as="p"
          className="muted"
          style={{ fontStyle: 'italic' }}
          placeholder="a motto for her"
          value={ship.tagline}
          onCommit={(v) => patchSingleton('ship', { tagline: v })}
        />
      </div>

      {/* Stats + upgrades */}
      <div>
        <div className="row-between">
          <h3 className="section-title small">Ship's Condition</h3>
          {canEdit && (
            <button
              className="btn small ghost"
              onClick={() => setStats([...stats, { label: 'New Stat', value: 0, max: 10 }])}
            >+ stat</button>
          )}
        </div>
        <hr className="rule" />
        {stats.map((s, i) => {
          const pct = s.max ? Math.max(0, Math.min(100, (Number(s.value) / Number(s.max)) * 100)) : 0
          const update = (patch) => setStats(stats.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return (
            <div className="stat-row" key={i}>
              <div className="stat-head">
                <span className="stat-label">
                  <Editable value={s.label} onCommit={(v) => update({ label: v })} />
                </span>
                <span className="stat-val">
                  <Editable type="number" value={s.value} onCommit={(v) => update({ value: v })} /> /{' '}
                  <Editable type="number" value={s.max} onCommit={(v) => update({ max: v })} />
                  {canEdit && (
                    <button
                      className="btn small danger"
                      style={{ marginLeft: 8 }}
                      onClick={() => setStats(stats.filter((_, j) => j !== i))}
                    >✕</button>
                  )}
                </span>
              </div>
              <div className="stat-track"><div className="stat-fill" style={{ width: `${pct}%` }} /></div>
            </div>
          )
        })}

        <div className="row-between" style={{ marginTop: 22 }}>
          <h3 className="section-title small">Upgrades & Modifications</h3>
          {canEdit && (
            <button
              className="btn small ghost"
              onClick={() => setUpgrades([...upgrades, { name: 'New Upgrade', description: '', installed: false }])}
            >+ upgrade</button>
          )}
        </div>
        <hr className="rule" />
        <div className="list">
          {upgrades.length === 0 && <span className="muted">No modifications yet.</span>}
          {upgrades.map((u, i) => {
            const update = (patch) => setUpgrades(upgrades.map((x, j) => (j === i ? { ...x, ...patch } : x)))
            return (
              <div className="card row-between" key={i} style={{ opacity: u.installed ? 1 : 0.62 }}>
                <div className="grow">
                  <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!u.installed}
                      disabled={!canEdit}
                      onChange={(e) => update({ installed: e.target.checked })}
                    />
                    <strong><Editable value={u.name} onCommit={(v) => update({ name: v })} /></strong>
                  </div>
                  <div className="muted" style={{ fontSize: 15 }}>
                    <Editable value={u.description} placeholder="what it does" onCommit={(v) => update({ description: v })} />
                  </div>
                </div>
                {canEdit && (
                  <button className="btn small danger" onClick={() => setUpgrades(upgrades.filter((_, j) => j !== i))}>✕</button>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 22 }}>
          <label className="eyebrow">Captain's notes</label>
          <Editable
            as="p"
            multiline
            placeholder="Anything worth remembering about her…"
            value={ship.notes}
            onCommit={(v) => patchSingleton('ship', { notes: v })}
          />
        </div>
      </div>
    </div>
  )
}
