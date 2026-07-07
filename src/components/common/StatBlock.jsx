import { useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useRoller } from '../../context/RollContext'
import { parseExpr, rollD20, fmt, abilityMod } from '../../lib/dice'
import Editable from './Editable'

const ABBR = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

// D&D-Beyond-style sheet for player characters, with click-to-roll everywhere.
// Reads the imported `sheet_data`; every roll respects the Adv/Dis toggle.
// `ownCharEditable` (HP + rolling — always on for the linked player) and
// `deepEditable` (ability scores/max HP — behind their edit-mode toggle) let
// the crew member linked to this PC act on their own sheet without the
// DM/admin canEdit flag; nobody else can roll or edit it either way.
export default function StatBlock({ member, ownCharEditable = false, deepEditable = false }) {
  const { patchItem, canEdit } = useData()
  const roller = useRoller()
  const s = member.sheet_data
  const [mode, setMode] = useState('normal')
  const [expr, setExpr] = useState('')
  const [log, setLog] = useState([])
  const counter = useRef(0)
  if (!s) return null

  const push = (e) => { setLog((l) => [{ id: ++counter.current, ...e }, ...l].slice(0, 14)); roller?.show(e) }
  const d20 = (label, m) => { const r = rollD20(m, mode); push({ label, detail: r.detail, total: r.total, crit: r.crit, fumble: r.fumble, face: r.base }) }
  const dmg = (label, e) => { const r = parseExpr(e); if (r) push({ label: `${label} damage`, detail: r.detail, total: r.total }) }
  const custom = () => { const r = parseExpr(expr); if (r) push({ label: expr.trim(), detail: r.detail, total: r.total }) }

  const setSheet = (patch) => patchItem('crew', member.id, { sheet_data: { ...s, ...patch } })
  const cur = s.hpCurrent ?? s.maxHp
  const setHp = (v) => setSheet({ hpCurrent: Math.max(0, Math.min(Number(v) || 0, (s.maxHp || 0) + 100)) })

  const abils = s.abilities || {}
  const skills = s.skills || []
  // Editing a raw score wouldn't mean much if the derived mod/save it's
  // sitting next to (imported from D&D Beyond as independent numbers, not
  // computed here) went stale — recompute both from the new score.
  const setAbilityScore = (k, val) => {
    const score = Number(val) || 0
    const mod = abilityMod(score)
    const a = abils[k] || {}
    setSheet({ abilities: { ...abils, [k]: { ...a, score, mod, save: mod + (a.saveProf ? (s.profBonus || 0) : 0) } } })
  }

  return (
    <div className="statblock">
      <div className="sb-classline">{s.classLine} · {s.race}{s.alignment ? ` · ${s.alignment}` : ''}</div>

      <div className="sb-rollbar">
        <div className="toolbar" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>rolls:</span>
          {[['normal', 'Normal'], ['adv', 'Adv'], ['dis', 'Dis']].map(([m, lbl]) => (
            <button key={m} className={`btn small ${mode === m ? 'brass' : 'ghost'}`} onClick={() => setMode(m)}>{lbl}</button>
          ))}
        </div>
        {log[0] && (
          <div className={`sb-latest ${log[0].crit ? 'crit' : ''} ${log[0].fumble ? 'fumble' : ''}`}>
            <span className="sb-latest-total">{log[0].total}</span>
            <span className="muted">{log[0].label}</span>
          </div>
        )}
      </div>

      <div className="sb-combat">
        <div className="sb-stat">
          <div className="sb-stat-num">
            {canEdit
              ? <input className="input sb-hp-input" type="number" value={s.ac} onChange={(e) => setSheet({ ac: Number(e.target.value) })} />
              : s.ac}
          </div>
          <div className="sb-stat-lbl">Armor</div>
        </div>
        <div className="sb-stat sb-hp">
          <div className="sb-stat-num">
            {ownCharEditable
              ? <input className="input sb-hp-input" type="number" value={cur} onChange={(e) => setHp(e.target.value)} />
              : cur}
            <span className="muted" style={{ fontSize: 14 }}>
              {' / '}
              {deepEditable
                ? <Editable type="number" value={s.maxHp} onCommit={(v) => setSheet({ maxHp: Number(v) })} />
                : s.maxHp}
            </span>
          </div>
          <div className="sb-stat-lbl">Hit Points</div>
          {ownCharEditable && (
            <div className="sb-hp-btns">
              <button className="btn small danger" onClick={() => setHp(cur - 1)}>−</button>
              <button className="btn small" onClick={() => setHp(cur + 1)}>+</button>
              <button className="btn small ghost" onClick={() => setHp(s.maxHp)}>full</button>
            </div>
          )}
        </div>
        <button className="sb-stat sb-click" disabled={!ownCharEditable} onClick={() => d20('Initiative', s.initiative)}>
          <div className="sb-stat-num">{fmt(s.initiative)}</div><div className="sb-stat-lbl">Initiative ⚄</div>
        </button>
        <div className="sb-stat"><div className="sb-stat-num">{s.speed}<span className="muted" style={{ fontSize: 12 }}>ft</span></div><div className="sb-stat-lbl">Speed</div></div>
        <div className="sb-stat"><div className="sb-stat-num">+{s.profBonus}</div><div className="sb-stat-lbl">Prof</div></div>
        <div className="sb-stat"><div className="sb-stat-num">{s.passivePerception}</div><div className="sb-stat-lbl">Passive</div></div>
      </div>

      <div className="sb-abilities">
        {ABBR.map((k) => {
          const a = abils[k] || {}
          return (
            <div className="sb-abil" key={k}>
              <div className="sb-abil-abbr">{k}</div>
              <button className="sb-abil-mod sb-click" disabled={!ownCharEditable} onClick={() => d20(`${k} check`, a.mod)} title="Roll ability check">{fmt(a.mod)}</button>
              {deepEditable
                ? <input className="input ability-input" type="number" value={a.score ?? ''} onChange={(e) => setAbilityScore(k, e.target.value)} />
                : <div className="sb-abil-score">{a.score}</div>}
              <button className="sb-abil-save sb-click" disabled={!ownCharEditable} onClick={() => d20(`${k} save`, a.save)} title="Roll saving throw">
                save {fmt(a.save)}{a.saveProf ? ' ●' : ''}
              </button>
            </div>
          )
        })}
      </div>

      <div className="sb-section-title">Skills</div>
      <div className="sb-skills">
        {skills.map((sk) => (
          <button key={sk.n} className="sb-skill sb-click" disabled={!ownCharEditable} onClick={() => d20(sk.n, sk.m)}>
            <span className={`sb-dot ${sk.p ? 'on' : ''} ${sk.e ? 'exp' : ''}`} />
            <span className="sb-skill-name">{sk.n}</span>
            <span className="sb-skill-abil muted">{sk.a}</span>
            <span className="sb-skill-mod">{fmt(sk.m)}</span>
          </button>
        ))}
      </div>

      <div className="sb-section-title">Attacks & Actions</div>
      <div className="sb-attacks">
        {(s.attacks || []).map((at, i) => (
          <div className="sb-attack" key={i}>
            <div className="sb-attack-info">
              <div className="sb-attack-name">{at.n}</div>
              <div className="sb-attack-sub muted">
                {[at.type, at.range, at.notes].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button className="btn small sb-atk-btn" disabled={!ownCharEditable} title="Roll to hit" onClick={() => d20(`${at.n} attack`, at.toHit)}>{fmt(at.toHit)} hit</button>
            <button className="btn small brass sb-atk-btn" disabled={!ownCharEditable} title="Roll damage" onClick={() => dmg(at.n, at.dmg)}>{at.dmg}</button>
          </div>
        ))}
      </div>

      {s.spells && s.spells.length > 0 && (
        <>
          <div className="sb-section-title">Spells</div>
          <div className="sb-taglist">
            {s.spells.map((sp, i) => <span key={i} className="sb-tag">{sp}</span>)}
          </div>
        </>
      )}

      {s.features && s.features.length > 0 && (
        <>
          <div className="sb-section-title">Features & Traits</div>
          <div className="sb-taglist">
            {s.features.map((f, i) => <span key={i} className="sb-tag">{f}</span>)}
          </div>
        </>
      )}

      {s.spell && (
        <>
          <div className="sb-section-title">Spellcasting</div>
          <div className="sb-spell">
            <span>Ability <strong>{s.spell.ability}</strong></span>
            <span>Save DC <strong>{s.spell.saveDc}</strong></span>
            <button className="btn small sb-click" disabled={!ownCharEditable} onClick={() => d20('Spell attack', s.spell.atk)}>Spell attack {fmt(s.spell.atk)}</button>
          </div>
        </>
      )}

      <div className="toolbar" style={{ marginTop: 12 }}>
        {ownCharEditable && (
          <>
            <input className="input" placeholder="custom roll, e.g. 2d6+3" value={expr}
              onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && custom()} style={{ maxWidth: 200 }} />
            <button className="btn brass" onClick={custom}>Roll</button>
          </>
        )}
        {log.length > 0 && <button className="btn small ghost" onClick={() => setLog([])}>Clear</button>}
      </div>
      <div className="dice-log">
        {log.map((r) => (
          <div key={r.id} className={`dice-line ${r.crit ? 'crit' : ''} ${r.fumble ? 'fumble' : ''}`}>
            <span className="dice-total">{r.total}</span>
            <span className="dice-label">{r.label}</span>
            <span className="dice-detail muted">{r.detail}</span>
          </div>
        ))}
      </div>

      {canEdit && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Values imported from D&D Beyond as displayed on the sheet. Everything here is editable — just ask Claude to refresh after you level up or change gear.
        </p>
      )}
    </div>
  )
}
