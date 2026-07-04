import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useRoller } from '../../context/RollContext'
import { assetUrl } from '../../lib/asset'
import { rollD20, parseExpr, fmt } from '../../lib/dice'
import Editable from '../common/Editable'

const ABILS = ['STR', 'DEX', 'CON', 'CHA']

// Quick repairs (repeatable). Costs are easy to retune.
const REPAIRS = [
  { key: 'repair_hull', name: 'Repair the Hull', desc: 'Restore the ship’s HP to maximum.', cost: 50, apply: (sd) => ({ hpCurrent: sd.hpMax }) },
  { key: 'repair_sails', name: 'Repair the Sails', desc: 'Restore current speed to maximum.', cost: 50, apply: (sd) => ({ speedCurrent: sd.speedMax }) },
]

// Upgrades are a data-driven, editable catalog (stored in settings.shipyard_upgrades).
// Each effect is a numeric delta on one stat, so installing and un-installing are
// perfectly reversible. Editable in-app when the log is unlocked.
const STAT_OPTS = [
  { v: 'hpMax', label: 'Max HP' },
  { v: 'crewMax', label: 'Crew capacity' },
  { v: 'passengerMax', label: 'Passenger capacity' },
  { v: 'ac', label: 'Armor Class' },
  { v: 'speedMax', label: 'Max Speed' },
  { v: 'cannonHit', label: 'Cannon to-hit' },
]
const DEFAULT_UPGRADES = [
  { id: 'hull', name: 'Hull Reinforcement', desc: 'Reinforce the hull with iron banding.', cost: 150, stat: 'hpMax', amount: 5, installed: false },
  { id: 'quarters', name: 'Expanded Quarters', desc: 'Sling extra hammocks below decks.', cost: 200, stat: 'crewMax', amount: 1, installed: false },
  { id: 'cannon', name: 'Enhanced Cannons', desc: 'Bored and trued barrels — steadier fire.', cost: 250, stat: 'cannonHit', amount: 1, installed: false },
]
const statLabel = (v) => STAT_OPTS.find((o) => o.v === v)?.label || v
const effectLabel = (u) => `${Number(u.amount) >= 0 ? '+' : ''}${u.amount} ${statLabel(u.stat)}`
// Return the ship_data patch for applying `amount` of `stat` (negate to reverse).
function effectPatch(sd, stat, amount) {
  const n = Number(amount) || 0
  if (stat === 'cannonHit') {
    return { attacks: (sd.attacks || []).map((a) => (a.name === 'Cannons' ? { ...a, toHit: (a.toHit || 0) + n } : a)) }
  }
  return { [stat]: (Number(sd[stat]) || 0) + n }
}

export default function ShipTab() {
  const { ship, crew, settings, patchSingleton, addItem, setSetting, canEdit } = useData()
  const roller = useRoller()
  const [mode, setMode] = useState('normal')
  const [pass, setPass] = useState('')
  const [yardOpen, setYardOpen] = useState(false)
  const [passErr, setPassErr] = useState(false)

  if (!ship) return <p className="muted">No ship on record.</p>
  const sd = ship.ship_data || {}
  const abilities = sd.abilities || {}
  const attacks = sd.attacks || []
  const traits = sd.traits || []
  const aboard = crew.filter((c) => c.location === 'ship').length
  const pax = crew.filter((c) => c.location === 'passenger').length
  const crewMax = sd.crewMax ?? 14
  const paxMax = sd.passengerMax ?? 5
  const hpCur = sd.hpCurrent ?? sd.hpMax ?? 0

  // Upgrade catalog (editable, persisted in settings). Falls back to defaults.
  const upgrades = Array.isArray(settings?.shipyard_upgrades) && settings.shipyard_upgrades.length
    ? settings.shipyard_upgrades
    : DEFAULT_UPGRADES
  const installedList = upgrades.filter((u) => u.installed)
  const saveUpgrades = (next) => setSetting('shipyard_upgrades', next)

  const setSd = (patch) => patchSingleton('ship', { ship_data: { ...sd, ...patch } })
  const setHp = (v) => setSd({ hpCurrent: Math.max(0, Math.min(Number(v) || 0, (sd.hpMax || 0) + 200)) })

  const rollAbility = (ab) => { const r = rollD20(abilities[ab] || 0, mode); roller?.show({ label: `Ship ${ab} check`, total: r.total, detail: r.detail, face: r.base, crit: r.crit, fumble: r.fumble }) }
  const rollHit = (at) => { const r = rollD20(at.toHit || 0, mode); roller?.show({ label: `${at.name} — to hit`, total: r.total, detail: r.detail, face: r.base, crit: r.crit, fumble: r.fumble }) }
  const rollDmg = (at) => { const r = parseExpr(at.dmg || '1d8'); if (r) roller?.show({ label: `${at.name} — damage`, total: r.total, detail: r.detail }) }

  const shipyardPass = settings?.shipyard_passphrase
  const tryUnlock = (e) => {
    e.preventDefault()
    if (shipyardPass == null || String(pass) === String(shipyardPass)) { setYardOpen(true); setPassErr(false) }
    else setPassErr(true)
  }
  const buyRepair = async (item) => {
    await patchSingleton('ship', { ship_data: { ...sd, ...item.apply(sd) } })
    await addItem('ledger', { description: `Shipyard — ${item.name}`, amount: -Math.abs(item.cost), category: 'Shipyard' })
  }

  // Install / uninstall is a reversible toggle: it applies (or reverses) the
  // stat effect, flips the flag, and records the cost (or a refund) in the ledger.
  const toggleInstall = async (u) => {
    const turningOn = !u.installed
    const patch = effectPatch(sd, u.stat, turningOn ? u.amount : -u.amount)
    await patchSingleton('ship', { ship_data: { ...sd, ...patch } })
    saveUpgrades(upgrades.map((x) => (x.id === u.id ? { ...x, installed: turningOn } : x)))
    await addItem('ledger', {
      description: `Shipyard — ${turningOn ? 'installed' : 'removed'} ${u.name}`,
      amount: (turningOn ? -1 : 1) * Math.abs(Number(u.cost) || 0),
      category: 'Shipyard',
    })
  }

  const patchUpgrade = (id, patch) => saveUpgrades(upgrades.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  const addUpgrade = () => {
    const id = 'u_' + Math.random().toString(36).slice(2, 8)
    saveUpgrades([...upgrades, { id, name: 'New Upgrade', desc: '', cost: 100, stat: 'hpMax', amount: 5, installed: false }])
  }
  const deleteUpgrade = async (u) => {
    if (u.installed) {
      const patch = effectPatch(sd, u.stat, -u.amount) // reverse before removing
      await patchSingleton('ship', { ship_data: { ...sd, ...patch } })
    }
    saveUpgrades(upgrades.filter((x) => x.id !== u.id))
  }

  const Tile = ({ num, lbl, span, danger }) => (
    <div className="sb-stat" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <div className="sb-stat-num" style={danger ? { color: 'var(--wax-red)' } : undefined}>{num}</div>
      <div className="sb-stat-lbl">{lbl}</div>
    </div>
  )

  return (
    <div className="panel-grid" style={{ gridTemplateColumns: 'minmax(260px, 1fr) 1.5fr', alignItems: 'start' }}>
      <div>
        <div className="card" style={{ aspectRatio: '4/3', display: 'grid', placeItems: 'center', overflow: 'hidden', backgroundImage: ship.image_url ? `url("${assetUrl(ship.image_url)}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
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
          <Editable value={sd.class} onCommit={(v) => setSd({ class: v })} /> · {sd.size}
        </div>
        <Editable as="p" className="muted" style={{ fontStyle: 'italic' }} placeholder="a motto for her" value={ship.tagline} onCommit={(v) => patchSingleton('ship', { tagline: v })} />
      </div>

      <div>
        <div className="sb-rollbar">
          <div className="toolbar" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>rolls:</span>
            {[['normal', 'Normal'], ['adv', 'Adv'], ['dis', 'Dis']].map(([m, lbl]) => (
              <button key={m} className={`btn small ${mode === m ? 'brass' : 'ghost'}`} onClick={() => setMode(m)}>{lbl}</button>
            ))}
          </div>
        </div>

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
          <Tile num={sd.hd} lbl="Hit Dice" />
          <div className="sb-stat">
            <div className="sb-stat-num">
              {canEdit ? <input className="input sb-hp-input" type="number" value={sd.speedCurrent ?? ''} onChange={(e) => setSd({ speedCurrent: Number(e.target.value) })} /> : (sd.speedCurrent ?? sd.speedMax)}
              <span className="muted" style={{ fontSize: 14 }}> / {sd.speedMax}</span>
            </div>
            <div className="sb-stat-lbl">Speed</div>
          </div>
          <Tile num={sd.actions} lbl="Actions" />
          <Tile num={sd.cargo} lbl="Cargo Holds" />
          <div className="sb-stat"><div className="sb-stat-num" style={aboard > crewMax ? { color: 'var(--wax-red)' } : undefined}>{aboard} <span className="muted" style={{ fontSize: 15 }}>/ {crewMax}</span></div><div className="sb-stat-lbl">Crew</div></div>
          <div className="sb-stat"><div className="sb-stat-num" style={pax > paxMax ? { color: 'var(--wax-red)' } : undefined}>{pax} <span className="muted" style={{ fontSize: 15 }}>/ {paxMax}</span></div><div className="sb-stat-lbl">Passengers</div></div>
        </div>

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

        <div className="sb-section-title">Broadside</div>
        <div className="sb-attacks">
          {attacks.map((at, i) => (
            <div className="sb-attack" key={i}>
              <div className="sb-attack-info">
                <div className="sb-attack-name">{at.name}</div>
                <div className="sb-attack-sub muted">{at.note}</div>
              </div>
              <button className="btn small sb-atk-btn" onClick={() => rollHit(at)} title="Roll to hit">{fmt(at.toHit || 0)} hit</button>
              <button className="btn small brass sb-atk-btn" onClick={() => rollDmg(at)} title="Roll damage">{at.dmg}</button>
            </div>
          ))}
        </div>

        {traits.length > 0 && (
          <>
            <div className="sb-section-title">Traits</div>
            <div className="list">
              {traits.map((t, i) => (
                <div className="card" key={i}><strong>{t.name}.</strong> <span className="muted">{t.desc}</span></div>
              ))}
            </div>
          </>
        )}

        <div className="sb-section-title">Upgrades & Shipyard</div>
        {!yardOpen ? (
          <div className="card">
            <p style={{ margin: '0 0 10px' }}>⚓ Visit a shipyard to fit repairs and upgrades.</p>
            <form className="toolbar" onSubmit={tryUnlock}>
              <input className="input" type="password" style={{ maxWidth: 220 }} placeholder="shipyard password" value={pass} onChange={(e) => { setPass(e.target.value); setPassErr(false) }} />
              <button className="btn brass" type="submit">Enter shipyard</button>
            </form>
            {passErr && <p style={{ color: 'var(--wax-red)', marginTop: 8, marginBottom: 0 }}>That gate stays shut. (Wrong password.)</p>}
            {installedList.length > 0 && <p className="muted" style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}>Fitted: {installedList.map((u) => u.name).join(', ')}.</p>}
          </div>
        ) : (
          <div>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="eyebrow">Shipwright's offerings</span>
              <button className="btn small ghost" onClick={() => setYardOpen(false)}>Leave shipyard</button>
            </div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Repairs</div>
            <div className="list" style={{ marginBottom: 14 }}>
              {REPAIRS.map((u) => (
                <div className="card row-between" key={u.key}>
                  <div className="grow"><strong>{u.name}</strong><div className="muted" style={{ fontSize: 14 }}>{u.desc}</div></div>
                  <div className="flex gap-sm" style={{ alignItems: 'center' }}><span className="coin gold" title="cost">{u.cost}</span><button className="btn brass small" onClick={() => buyRepair(u)}>Buy</button></div>
                </div>
              ))}
            </div>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span className="eyebrow">Upgrades</span>
              {canEdit && <button className="btn small ghost" onClick={addUpgrade}>+ add upgrade</button>}
            </div>
            <div className="list">
              {upgrades.map((u) => (
                <div className={`card ${u.installed ? 'yard-installed' : ''}`} key={u.id}>
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <strong>
                        <Editable value={u.name} onCommit={(v) => patchUpgrade(u.id, { name: v })} />
                      </strong>
                      {u.installed && <span className="badge main" style={{ marginLeft: 6 }}>fitted</span>}
                      <div className="muted" style={{ fontSize: 14 }}>
                        <Editable value={u.desc} placeholder="describe the upgrade…" onCommit={(v) => patchUpgrade(u.id, { desc: v })} />
                      </div>
                    </div>
                    <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                      <span className="coin gold" title="cost">
                        {canEdit ? <Editable type="number" value={u.cost} onCommit={(v) => patchUpgrade(u.id, { cost: Number(v) })} /> : u.cost}
                      </span>
                      <button className={`btn small ${u.installed ? 'ghost' : 'brass'}`} onClick={() => toggleInstall(u)}>
                        {u.installed ? 'Uninstall' : 'Install'}
                      </button>
                    </div>
                  </div>

                  <div className="row-between" style={{ marginTop: 8, alignItems: 'center' }}>
                    {canEdit && !u.installed ? (
                      <span className="flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                        <span className="muted">effect</span>
                        <input className="input" type="number" style={{ width: 64 }} value={u.amount}
                          onChange={(e) => patchUpgrade(u.id, { amount: Number(e.target.value) })} />
                        <select className="select" style={{ width: 170 }} value={u.stat}
                          onChange={(e) => patchUpgrade(u.id, { stat: e.target.value })}>
                          {STAT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: 13 }}>Effect: {effectLabel(u)}{u.installed && canEdit ? ' · uninstall to edit' : ''}</span>
                    )}
                    {canEdit && <button className="btn small danger" onClick={() => deleteUpgrade(u)}>Remove</button>}
                  </div>
                </div>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Install/Uninstall is a reversible toggle — installing records the cost in the ledger, uninstalling refunds it.
              {canEdit ? ' Unlocked: edit names, costs and effects, or add your own.' : ' Unlock the log up top to edit or add upgrades.'}
            </p>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <label className="eyebrow">Captain's notes</label>
          <Editable as="p" multiline placeholder="Anything worth remembering about her…" value={ship.notes} onCommit={(v) => patchSingleton('ship', { notes: v })} />
        </div>
      </div>
    </div>
  )
}
