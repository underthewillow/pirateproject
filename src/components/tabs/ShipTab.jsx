import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useRoller } from '../../context/RollContext'
import { assetUrl } from '../../lib/asset'
import { rollD20, parseExpr, fmt } from '../../lib/dice'
import Editable from '../common/Editable'

const ABILS = ['STR', 'DEX', 'CON', 'CHA']

// Shipyard upgrade catalogue. Costs are placeholders — easy to tweak later.
const UPGRADES = [
  { key: 'hull', name: 'Hull Reinforcement', desc: 'Increase the ship’s maximum HP by 5.', cost: 150, apply: (sd) => ({ hpMax: (sd.hpMax || 0) + 5 }) },
  { key: 'quarters', name: 'Expanded Quarters', desc: 'Increase crew capacity by 1.', cost: 100, apply: (sd) => ({ crewMax: (sd.crewMax || 0) + 1 }) },
  { key: 'cannon', name: 'Additional Cannon', desc: 'Mount another cannon (+1 to the ship’s attack bonus).', cost: 200, apply: (sd) => ({ atk: (sd.atk || 0) + 1 }) },
]

export default function ShipTab() {
  const { ship, crew, settings, patchSingleton, addItem, canEdit } = useData()
  const roller = useRoller()
  const [mode, setMode] = useState('normal')
  const [pass, setPass] = useState('')
  const [yardOpen, setYardOpen] = useState(false)
  const [passErr, setPassErr] = useState(false)

  if (!ship) return <p className="muted">No ship on record.</p>
  const sd = ship.ship_data || {}
  const abilities = sd.abilities || {}
  const aboard = crew.filter((c) => c.location === 'ship').length
  const crewMax = sd.crewMax ?? 15
  const hpCur = sd.hpCurrent ?? sd.hpMax ?? 0
  const applied = Array.isArray(ship.upgrades) ? ship.upgrades : []

  const setSd = (patch) => patchSingleton('ship', { ship_data: { ...sd, ...patch } })
  const setHp = (v) => setSd({ hpCurrent: Math.max(0, Math.min(Number(v) || 0, (sd.hpMax || 0) + 200)) })

  const rollAbility = (ab) => {
    const r = rollD20(abilities[ab] || 0, mode)
    roller?.show({ label: `Ship ${ab} check`, total: r.total, detail: r.detail, face: r.base, crit: r.crit, fumble: r.fumble })
  }
  const rollAttack = () => {
    const r = rollD20(sd.atk || 0, mode)
    roller?.show({ label: 'Cannons — to hit', total: r.total, detail: r.detail, face: r.base, crit: r.crit, fumble: r.fumble })
  }
  const rollDamage = () => {
    const r = parseExpr(sd.damage || '1d8')
    if (r) roller?.show({ label: 'Cannons — damage', total: r.total, detail: r.detail })
  }

  const shipyardPass = settings?.shipyard_passphrase
  const tryUnlock = (e) => {
    e.preventDefault()
    if (shipyardPass == null || String(pass) === String(shipyardPass)) { setYardOpen(true); setPassErr(false) }
    else setPassErr(true)
  }
  const applyUpgrade = async (u) => {
    if (!confirm(`Apply "${u.name}" for ${u.cost} gp? This records a shipyard expense in the ledger.`)) return
    await patchSingleton('ship', { ship_data: { ...sd, ...u.apply(sd) }, upgrades: [...applied, { key: u.key, name: u.name, cost: u.cost }] })
    await addItem('ledger', { description: `Shipyard — ${u.name}`, amount: -Math.abs(u.cost), category: 'Shipyard' })
  }

  return (
    <div className="panel-grid" style={{ gridTemplateColumns: 'minmax(260px, 1fr) 1.5fr', alignItems: 'start' }}>
      {/* Portrait + identity */}
      <div>
        <div
          className="card"
          style={{
            aspectRatio: '4/3', display: 'grid', placeItems: 'center', overflow: 'hidden',
            backgroundImage: ship.image_url ? `url("${assetUrl(ship.image_url)}")` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}
        >
          {!ship.image_url && <span className="muted center">⛵<br />Add a portrait of the ship</span>}
        </div>
        {canEdit && (
          <div style={{ marginTop: 8 }}>
            <label className="eyebrow">Ship image URL</label>
            <Editable value={ship.image_url} placeholder="paste an image link" onCommit={(v) => patchSingleton('ship', { image_url: v })} />
          </div>
        )}
        <h2 className="section-title" style={{ marginTop: 14 }}>
          <Editable value={ship.name} onCommit={(v) => patchSingleton('ship', { name: v })} />
        </h2>
        <div className="sb-classline">
          <Editable value={sd.class} onCommit={(v) => setSd({ class: v })} /> · {sd.size} · Speed {sd.speed}
        </div>
        <Editable as="p" className="muted" style={{ fontStyle: 'italic' }} placeholder="a motto for her"
          value={ship.tagline} onCommit={(v) => patchSingleton('ship', { tagline: v })} />
      </div>

      {/* Stat block */}
      <div>
        <div className="sb-rollbar">
          <div className="toolbar" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>rolls:</span>
            {[['normal', 'Normal'], ['adv', 'Adv'], ['dis', 'Dis']].map(([m, lbl]) => (
              <button key={m} className={`btn small ${mode === m ? 'brass' : 'ghost'}`} onClick={() => setMode(m)}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* combat row */}
        <div className="sb-combat" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="sb-stat">
            <div className="sb-stat-num">{canEdit ? <input className="input sb-hp-input" type="number" value={sd.ac ?? ''} onChange={(e) => setSd({ ac: Number(e.target.value) })} /> : sd.ac}</div>
            <div className="sb-stat-lbl">Armor</div>
          </div>
          <div className="sb-stat sb-hp">
            <div className="sb-stat-num">
              <input className="input sb-hp-input" type="number" value={hpCur} onChange={(e) => setHp(e.target.value)} />
              <span className="muted" style={{ fontSize: 14 }}> / {canEdit ? <Editable type="number" value={sd.hpMax} onCommit={(v) => setSd({ hpMax: Number(v) })} /> : sd.hpMax}</span>
            </div>
            <div className="sb-stat-lbl">Hit Points</div>
            <div className="sb-hp-btns">
              <button className="btn small danger" onClick={() => setHp(hpCur - 1)}>−</button>
              <button className="btn small" onClick={() => setHp(hpCur + 1)}>+</button>
              <button className="btn small ghost" onClick={() => setHp(sd.hpMax)}>full</button>
            </div>
          </div>
          <div className="sb-stat"><div className="sb-stat-num">{sd.hd}</div><div className="sb-stat-lbl">Hit Dice</div></div>
          <div className="sb-stat"><div className="sb-stat-num">{sd.speed}</div><div className="sb-stat-lbl">Speed</div></div>
          <div className="sb-stat"><div className="sb-stat-num">{sd.actions}</div><div className="sb-stat-lbl">Actions</div></div>
          <div className="sb-stat"><div className="sb-stat-num">{sd.cargo}</div><div className="sb-stat-lbl">Cargo Holds</div></div>
          <div className="sb-stat" style={{ gridColumn: 'span 2' }}>
            <div className="sb-stat-num" style={{ color: aboard > crewMax ? 'var(--wax-red)' : undefined }}>{aboard} <span className="muted" style={{ fontSize: 16 }}>/ {crewMax}</span></div>
            <div className="sb-stat-lbl">Crew Aboard</div>
          </div>
        </div>

        {/* abilities */}
        <div className="sb-abilities" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {ABILS.map((ab) => (
            <div className="sb-abil" key={ab}>
              <div className="sb-abil-abbr">{ab}</div>
              <button className="sb-abil-mod sb-click" onClick={() => rollAbility(ab)} title="Roll ship check">{fmt(abilities[ab] || 0)}</button>
              {canEdit
                ? <input className="input ability-input" type="number" value={abilities[ab] ?? 0} onChange={(e) => setSd({ abilities: { ...abilities, [ab]: Number(e.target.value) } })} />
                : <div className="sb-abil-score">check</div>}
            </div>
          ))}
        </div>

        {/* attack */}
        <div className="sb-section-title">Broadside</div>
        <div className="sb-attacks">
          <div className="sb-attack">
            <div className="sb-attack-info">
              <div className="sb-attack-name">Cannons</div>
              <div className="sb-attack-sub muted">{sd.actions}× per round{sd.traits && sd.traits.length ? ` · ${sd.traits.join(', ')}` : ''}</div>
            </div>
            <button className="btn small sb-atk-btn" onClick={rollAttack} title="Roll to hit">{fmt(sd.atk || 0)} hit</button>
            <button className="btn small brass sb-atk-btn" onClick={rollDamage} title="Roll damage">{sd.damage}</button>
          </div>
        </div>

        {sd.traits && sd.traits.length > 0 && (
          <>
            <div className="sb-section-title">Traits</div>
            <div className="sb-taglist">{sd.traits.map((t, i) => <span key={i} className="sb-tag">{t}</span>)}</div>
          </>
        )}

        {/* Shipyard upgrades */}
        <div className="sb-section-title">Upgrades & Shipyard</div>
        {!yardOpen ? (
          <div className="card">
            <p style={{ margin: '0 0 10px' }}>⚓ Visit a shipyard to learn about upgrade options.</p>
            <form className="toolbar" onSubmit={tryUnlock}>
              <input className="input" type="password" style={{ maxWidth: 220 }} placeholder="shipyard password" value={pass} onChange={(e) => { setPass(e.target.value); setPassErr(false) }} />
              <button className="btn brass" type="submit">Enter shipyard</button>
            </form>
            {passErr && <p style={{ color: 'var(--wax-red)', marginTop: 8, marginBottom: 0 }}>That gate stays shut. (Wrong password.)</p>}
            {applied.length > 0 && <p className="muted" style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}>Installed: {applied.map((u) => u.name).join(', ')}.</p>}
          </div>
        ) : (
          <div>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="eyebrow">Shipwright's offerings</span>
              <button className="btn small ghost" onClick={() => setYardOpen(false)}>Leave shipyard</button>
            </div>
            <div className="list">
              {UPGRADES.map((u) => {
                const count = applied.filter((a) => a.key === u.key).length
                return (
                  <div className="card row-between" key={u.key}>
                    <div className="grow">
                      <strong>{u.name}</strong>{count > 0 && <span className="muted"> · installed ×{count}</span>}
                      <div className="muted" style={{ fontSize: 14 }}>{u.desc}</div>
                    </div>
                    <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                      <span className="coin gold" title="cost">{u.cost}</span>
                      <button className="btn brass small" onClick={() => applyUpgrade(u)}>Install</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Installing records the cost as a ledger expense. Costs are placeholders — we can refine them.</p>
          </div>
        )}

        {/* notes */}
        <div style={{ marginTop: 18 }}>
          <label className="eyebrow">Captain's notes</label>
          <Editable as="p" multiline placeholder="Anything worth remembering about her…" value={ship.notes} onCommit={(v) => patchSingleton('ship', { notes: v })} />
        </div>
      </div>
    </div>
  )
}
