import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useRoller } from '../../context/RollContext'
import { rollD20, parseExpr, fmt, abilityMod } from '../../lib/dice'
import Editable from './Editable'

const ABILS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const SKILL_ABIL = {
  Acrobatics: 'DEX', 'Animal Handling': 'WIS', Arcana: 'INT', Athletics: 'STR', Deception: 'CHA',
  History: 'INT', Insight: 'WIS', Intimidation: 'CHA', Investigation: 'INT', Medicine: 'WIS',
  Nature: 'INT', Perception: 'WIS', Performance: 'CHA', Persuasion: 'CHA', Religion: 'INT',
  'Sleight of Hand': 'DEX', Stealth: 'DEX', Survival: 'WIS',
}
const ALL_SKILLS = Object.keys(SKILL_ABIL)

// A row of tick-boxes for limited-use abilities (e.g. "3 per combat"). Anyone
// can tick/untick them to track uses in the moment — it's not gated by editing.
function UsesTicker({ max, used, onChange }) {
  const m = Number(max) || 0
  if (m < 1) return null
  const u = Math.max(0, Math.min(Number(used) || 0, m))
  const clickPip = (i) => onChange(i + 1 === u ? i : i + 1) // tally-style toggle
  return (
    <span className="uses-ticker" title={`${m - u} of ${m} left`} onClick={(e) => e.stopPropagation()}>
      {Array.from({ length: m }, (_, i) => (
        <button key={i} className={`use-pip ${i < u ? 'spent' : ''}`} onClick={() => clickPip(i)} aria-label={`use ${i + 1}`} />
      ))}
      {u > 0 && <button className="use-reset" title="Reset uses" onClick={() => onChange(0)}>↺</button>}
    </span>
  )
}

// Editable, rollable stat block for NPC crew (distinct from the D&D-Beyond PC
// sheet). Most of it is editable only when the log is unlocked (admin / DM);
// `ownCharEditable` (HP + rolling) and `deepEditable` (ability scores/max HP,
// behind its edit-mode toggle) additionally open those specific pieces to
// whoever this NPC is linked to (same self-service tier a linked PC gets).
export default function NpcStatBlock({ member, ownCharEditable = false, deepEditable = false }) {
  const { patchItem, canEdit } = useData()
  const roller = useRoller()
  const [mode, setMode] = useState('normal')

  const s = member.sheet_data || {}
  const abilities = s.abilities || {}
  const pb = Number(s.pb) || 2
  const saves = Array.isArray(s.saves) ? s.saves : []
  const skills = Array.isArray(s.skills) ? s.skills : []
  const attacks = Array.isArray(s.attacks) ? s.attacks : []
  const traits = Array.isArray(s.traits) ? s.traits : []

  const setSheet = (patch) => patchItem('crew', member.id, { sheet_data: { ...s, ...patch } })
  const mod = (ab) => abilityMod(abilities[ab] ?? 10)
  const saveMod = (ab) => mod(ab) + (saves.includes(ab) ? pb : 0)
  const hpCur = s.hpCurrent ?? s.maxHp ?? 0
  const setHp = (v) => setSheet({ hpCurrent: Math.max(0, Math.min(Number(v) || 0, (Number(s.maxHp) || 0) + 100)) })

  const d20 = (label, m) => { const r = rollD20(m, mode); roller?.show({ label, total: r.total, detail: r.detail, face: r.base, crit: r.crit, fumble: r.fumble }) }
  const rollExpr = (label, expr) => { const r = parseExpr(expr); if (r) roller?.show({ label, total: r.total, detail: r.detail }) }

  // editors
  const patchAttack = (i, p) => setSheet({ attacks: attacks.map((a, j) => (j === i ? { ...a, ...p } : a)) })
  const addAttack = () => setSheet({ attacks: [...attacks, { n: 'New Attack', toHit: 4, dmg: '1d6+2', notes: '' }] })
  const rmAttack = (i) => setSheet({ attacks: attacks.filter((_, j) => j !== i) })
  const patchTrait = (i, p) => setSheet({ traits: traits.map((t, j) => (j === i ? { ...t, ...p } : t)) })
  const addTrait = () => setSheet({ traits: [...traits, { n: 'New Ability', d: '', roll: '' }] })
  const rmTrait = (i) => setSheet({ traits: traits.filter((_, j) => j !== i) })
  const toggleSave = (ab) => setSheet({ saves: saves.includes(ab) ? saves.filter((x) => x !== ab) : [...saves, ab] })
  const resetAllUses = () => setSheet({
    attacks: attacks.map((a) => (a.uses ? { ...a, used: 0 } : a)),
    traits: traits.map((t) => (t.uses ? { ...t, used: 0 } : t)),
  })
  const hasUses = attacks.some((a) => a.uses) || traits.some((t) => t.uses)
  const addSkill = (name) => { if (name && !skills.includes(name)) setSheet({ skills: [...skills, name] }) }
  const rmSkill = (name) => setSheet({ skills: skills.filter((x) => x !== name) })

  const openSkills = ALL_SKILLS.filter((k) => !skills.includes(k))

  return (
    <div className="statblock npc-block">
      {/* class line */}
      <div className="sb-classline">
        {canEdit ? (
          <span className="flex gap-sm wrap" style={{ alignItems: 'center' }}>
            Lv <input className="input npc-mini" type="number" value={s.level ?? 1} onChange={(e) => setSheet({ level: Number(e.target.value) })} />
            · <Editable value={s.role} placeholder="role (e.g. Sharpshooter)" onCommit={(v) => setSheet({ role: v })} />
            · <Editable value={s.race} placeholder="species" onCommit={(v) => setSheet({ race: v })} />
          </span>
        ) : (
          <>Level {s.level ?? 1}{s.role ? ` · ${s.role}` : ''}{s.race ? ` · ${s.race}` : ''}</>
        )}
      </div>

      {/* roll mode */}
      <div className="sb-rollbar">
        <div className="toolbar" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>rolls:</span>
          {[['normal', 'Normal'], ['adv', 'Adv'], ['dis', 'Dis']].map(([m, lbl]) => (
            <button key={m} className={`btn small ${mode === m ? 'brass' : 'ghost'}`} onClick={() => setMode(m)}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* combat line */}
      <div className="sb-combat" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="sb-stat">
          <div className="sb-stat-num">
            {canEdit ? <input className="input sb-hp-input" type="number" value={s.ac ?? 10} onChange={(e) => setSheet({ ac: Number(e.target.value) })} /> : (s.ac ?? 10)}
          </div>
          <div className="sb-stat-lbl">Armor</div>
        </div>
        <div className="sb-stat sb-hp">
          <div className="sb-stat-num">
            {ownCharEditable
              ? <input className="input sb-hp-input" type="number" value={hpCur} onChange={(e) => setHp(e.target.value)} />
              : hpCur}
            <span className="muted" style={{ fontSize: 14 }}> / {deepEditable ? <Editable type="number" value={s.maxHp} onCommit={(v) => setSheet({ maxHp: Number(v) })} /> : s.maxHp}</span>
          </div>
          <div className="sb-stat-lbl">Hit Points</div>
          {ownCharEditable && (
            <div className="sb-hp-btns">
              <button className="btn small danger" onClick={() => setHp(hpCur - 1)}>−</button>
              <button className="btn small" onClick={() => setHp(hpCur + 1)}>+</button>
              <button className="btn small ghost" onClick={() => setHp(s.maxHp)}>full</button>
            </div>
          )}
        </div>
        <button className="sb-stat sb-click" disabled={!ownCharEditable} onClick={() => d20('Initiative', mod('DEX'))}>
          <div className="sb-stat-num">{fmt(mod('DEX'))}</div><div className="sb-stat-lbl">Initiative</div>
        </button>
        <div className="sb-stat">
          <div className="sb-stat-num">
            {canEdit ? <input className="input sb-hp-input" type="number" value={s.speed ?? 30} onChange={(e) => setSheet({ speed: Number(e.target.value) })} /> : (s.speed ?? 30)}
            <span className="muted" style={{ fontSize: 12 }}>ft</span>
          </div>
          <div className="sb-stat-lbl">Speed</div>
        </div>
      </div>

      {/* abilities */}
      <div className="sb-abilities">
        {ABILS.map((ab) => (
          <div className="sb-abil" key={ab}>
            <div className="sb-abil-abbr">{ab}</div>
            <button className="sb-abil-mod sb-click" disabled={!ownCharEditable} onClick={() => d20(`${ab} check`, mod(ab))} title="Roll ability check">{fmt(mod(ab))}</button>
            {deepEditable
              ? <input className="input ability-input" type="number" value={abilities[ab] ?? 10} onChange={(e) => setSheet({ abilities: { ...abilities, [ab]: Number(e.target.value) } })} />
              : <div className="sb-abil-score">{abilities[ab] ?? 10}</div>}
            <button className="sb-abil-save sb-click" disabled={!ownCharEditable} onClick={() => d20(`${ab} save`, saveMod(ab))} title="Roll saving throw">
              save {fmt(saveMod(ab))}{saves.includes(ab) ? ' ●' : ''}
            </button>
            {canEdit && (
              <label className="npc-saveprof" title="Proficient save">
                <input type="checkbox" checked={saves.includes(ab)} onChange={() => toggleSave(ab)} /> prof
              </label>
            )}
          </div>
        ))}
      </div>

      {/* skills */}
      <div className="sb-section-title">Skills <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>· proficiency +{pb}</span></div>
      <div className="sb-skills">
        {skills.length === 0 && <span className="muted">No trained skills.</span>}
        {skills.map((name) => (
          <span key={name} className="npc-skill">
            <button className="sb-skill sb-click" disabled={!ownCharEditable} onClick={() => d20(name, mod(SKILL_ABIL[name]) + pb)}>
              <span className="sb-skill-name">{name}</span>
              <span className="sb-skill-abil muted">{SKILL_ABIL[name]}</span>
              <span className="sb-skill-mod">{fmt(mod(SKILL_ABIL[name]) + pb)}</span>
            </button>
            {canEdit && <button className="npc-x" onClick={() => rmSkill(name)}>✕</button>}
          </span>
        ))}
      </div>
      {canEdit && openSkills.length > 0 && (
        <select className="select" style={{ maxWidth: 220, marginTop: 8 }} value="" onChange={(e) => addSkill(e.target.value)}>
          <option value="">+ add trained skill…</option>
          {openSkills.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      )}

      {/* attacks */}
      <div className="row-between" style={{ marginTop: 4 }}>
        <div className="sb-section-title" style={{ margin: '16px 0 8px' }}>Attacks</div>
        {canEdit && <button className="btn small ghost" onClick={addAttack}>+ attack</button>}
      </div>
      <div className="sb-attacks">
        {attacks.length === 0 && <span className="muted">No attacks.</span>}
        {attacks.map((a, i) => (
          <div className="sb-attack npc-atk" key={i}>
            <div className="sb-attack-info">
              <div className="sb-attack-name">{canEdit ? <Editable value={a.n} onCommit={(v) => patchAttack(i, { n: v })} /> : a.n}</div>
              <div className="sb-attack-sub muted">{canEdit ? <Editable value={a.notes} placeholder="range / notes…" onCommit={(v) => patchAttack(i, { notes: v })} /> : a.notes}</div>
            </div>
            {a.toHit !== '' && a.toHit != null && (
              <button className="btn small sb-atk-btn" disabled={!ownCharEditable} onClick={() => d20(`${a.n} — to hit`, Number(a.toHit))} title="Roll to hit">{fmt(Number(a.toHit) || 0)} hit</button>
            )}
            {a.dmg && <button className="btn small brass sb-atk-btn" disabled={!ownCharEditable} onClick={() => rollExpr(`${a.n} — damage`, a.dmg)} title="Roll damage">{a.dmg}</button>}
            {a.uses > 0 && <UsesTicker max={a.uses} used={a.used} onChange={(v) => patchAttack(i, { used: v })} />}
            {canEdit && (
              <div className="npc-atk-edit">
                <label>hit<input className="input npc-mini" type="number" value={a.toHit ?? ''} placeholder="—" onChange={(e) => patchAttack(i, { toHit: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
                <label>dmg<input className="input npc-dmg" value={a.dmg ?? ''} placeholder="1d8+2" onChange={(e) => patchAttack(i, { dmg: e.target.value })} /></label>
                <label>uses<input className="input npc-mini" type="number" min="0" value={a.uses ?? ''} placeholder="∞" onChange={(e) => patchAttack(i, { uses: e.target.value === '' ? 0 : Number(e.target.value) })} /></label>
                <button className="btn small danger" onClick={() => rmAttack(i)}>✕</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* special abilities */}
      <div className="row-between">
        <div className="sb-section-title" style={{ margin: '16px 0 8px' }}>Special Abilities</div>
        <span className="flex gap-sm">
          {hasUses && <button className="btn small ghost" onClick={resetAllUses} title="Reset all per-combat uses">↺ reset uses</button>}
          {canEdit && <button className="btn small ghost" onClick={addTrait}>+ ability</button>}
        </span>
      </div>
      <div className="list">
        {traits.length === 0 && <span className="muted">No special abilities.</span>}
        {traits.map((t, i) => (
          <div className="card npc-trait" key={i}>
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <strong style={{ fontFamily: 'var(--font-ui)' }}>{canEdit ? <Editable value={t.n} onCommit={(v) => patchTrait(i, { n: v })} /> : t.n}</strong>
              <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                {t.uses > 0 && <UsesTicker max={t.uses} used={t.used} onChange={(v) => patchTrait(i, { used: v })} />}
                {t.roll && <button className="btn small brass" disabled={!ownCharEditable} onClick={() => rollExpr(t.n, t.roll)} title="Roll">{t.roll}</button>}
                {canEdit && <button className="btn small danger" onClick={() => rmTrait(i)}>✕</button>}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>
              {canEdit ? <Editable multiline value={t.d} placeholder="describe the ability…" onCommit={(v) => patchTrait(i, { d: v })} /> : t.d}
            </div>
            {canEdit && (
              <div className="npc-trait-edit">
                <label className="npc-roll-field">roll (optional) <input className="input npc-dmg" value={t.roll ?? ''} placeholder="e.g. 2d6" onChange={(e) => patchTrait(i, { roll: e.target.value })} /></label>
                <label className="npc-roll-field">uses/combat <input className="input npc-mini" type="number" min="0" value={t.uses ?? ''} placeholder="∞" onChange={(e) => patchTrait(i, { uses: e.target.value === '' ? 0 : Number(e.target.value) })} /></label>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Unlocked (admin / DM): edit any value, add or remove attacks & abilities. Everything saves for the whole crew.</p>}
    </div>
  )
}
