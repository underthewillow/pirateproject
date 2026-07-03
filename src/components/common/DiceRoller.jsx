import { useRef, useState } from 'react'

const DICE = [4, 6, 8, 10, 12, 20, 100]
const ABILITIES = [
  ['STR', 'Strength'], ['DEX', 'Dexterity'], ['CON', 'Constitution'],
  ['INT', 'Intelligence'], ['WIS', 'Wisdom'], ['CHA', 'Charisma'],
]

const rollDie = (sides) => Math.floor(Math.random() * sides) + 1
export const abilityMod = (score) => Math.floor((Number(score) - 10) / 2)
const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`)

// Parse an expression like "2d6+3", "d20-1", "1d8 + 2".
function parseExpr(expr) {
  const terms = expr.replace(/\s+/g, '').match(/[+-]?(\d*d\d+|\d+)/gi)
  if (!terms) return null
  let total = 0
  const parts = []
  for (let t of terms) {
    let sign = 1
    if (t[0] === '+') t = t.slice(1)
    else if (t[0] === '-') { sign = -1; t = t.slice(1) }
    const m = t.match(/^(\d*)d(\d+)$/i)
    if (m) {
      const n = Math.min(50, Math.max(1, parseInt(m[1] || '1', 10)))
      const s = parseInt(m[2], 10)
      const vals = Array.from({ length: n }, () => rollDie(s))
      total += sign * vals.reduce((a, b) => a + b, 0)
      parts.push(`${sign < 0 ? '−' : ''}${n}d${s}[${vals.join(', ')}]`)
    } else {
      const v = sign * parseInt(t, 10)
      total += v
      parts.push(fmt(v))
    }
  }
  return { total, detail: parts.join(' ') }
}

// Read STR/DEX/… out of a flexible stats object (matches abbrev or full name).
function readAbilities(stats) {
  if (!stats || typeof stats !== 'object') return []
  const out = []
  for (const [abbr, full] of ABILITIES) {
    let score
    for (const k of Object.keys(stats)) {
      const kk = k.trim().toLowerCase()
      if (kk === abbr.toLowerCase() || kk === full.toLowerCase()) { score = stats[k]; break }
    }
    if (score !== undefined && score !== '' && !Number.isNaN(Number(score))) {
      out.push({ abbr, full, score: Number(score), mod: abilityMod(score) })
    }
  }
  return out
}

export default function DiceRoller({ member }) {
  const [modifier, setModifier] = useState(0)
  const [mode, setMode] = useState('normal') // normal | adv | dis (affects d20)
  const [expr, setExpr] = useState('')
  const [log, setLog] = useState([])
  const counter = useRef(0)

  const abilities = readAbilities(member?.stats)

  const push = (entry) =>
    setLog((l) => [{ id: ++counter.current, ...entry }, ...l].slice(0, 12))

  const rollQuick = (sides) => {
    let base, note = ''
    if (sides === 20 && mode !== 'normal') {
      const a = rollDie(20), b = rollDie(20)
      base = mode === 'adv' ? Math.max(a, b) : Math.min(a, b)
      note = ` ${mode === 'adv' ? '(adv' : '(dis'} ${a}/${b})`
    } else base = rollDie(sides)
    const mv = Number(modifier) || 0
    push({
      label: `d${sides}${mv ? ' ' + fmt(mv) : ''}`,
      detail: `[${base}]${note}${mv ? ' ' + fmt(mv) : ''}`,
      total: base + mv,
      crit: sides === 20 && base === 20,
      fumble: sides === 20 && base === 1,
    })
  }

  const rollAbility = (a) => {
    let base, note = ''
    if (mode !== 'normal') {
      const x = rollDie(20), y = rollDie(20)
      base = mode === 'adv' ? Math.max(x, y) : Math.min(x, y)
      note = ` ${mode === 'adv' ? '(adv' : '(dis'} ${x}/${y})`
    } else base = rollDie(20)
    push({
      label: `${a.abbr} check ${fmt(a.mod)}`,
      detail: `d20[${base}]${note} ${fmt(a.mod)}`,
      total: base + a.mod,
      crit: base === 20,
      fumble: base === 1,
    })
  }

  const rollExpr = () => {
    const r = parseExpr(expr)
    if (r) push({ label: expr.trim(), detail: r.detail, total: r.total })
  }

  return (
    <div className="dice">
      <div className="row-between">
        <label className="eyebrow">Dice</label>
        <div className="toolbar" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>d20 mode:</span>
          {['normal', 'adv', 'dis'].map((m) => (
            <button
              key={m}
              className={`btn small ${mode === m ? 'brass' : 'ghost'}`}
              onClick={() => setMode(m)}
            >{m === 'normal' ? 'Normal' : m === 'adv' ? 'Advantage' : 'Disadvantage'}</button>
          ))}
        </div>
      </div>

      <div className="flex wrap gap-sm" style={{ marginTop: 8, alignItems: 'center' }}>
        {DICE.map((d) => (
          <button key={d} className="btn dice-btn" onClick={() => rollQuick(d)}>d{d}</button>
        ))}
        <span className="flex gap-sm" style={{ alignItems: 'center', marginLeft: 4 }}>
          <span className="muted">mod</span>
          <input
            className="input"
            type="number"
            value={modifier}
            onChange={(e) => setModifier(e.target.value)}
            style={{ width: 64 }}
          />
        </span>
      </div>

      {abilities.length > 0 && (
        <div className="flex wrap gap-sm" style={{ marginTop: 8 }}>
          {abilities.map((a) => (
            <button key={a.abbr} className="btn small" onClick={() => rollAbility(a)}>
              {a.abbr} {fmt(a.mod)}
            </button>
          ))}
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 8 }}>
        <input
          className="input"
          placeholder="custom roll, e.g. 2d6+3"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && rollExpr()}
          style={{ maxWidth: 200 }}
        />
        <button className="btn brass" onClick={rollExpr}>Roll</button>
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
    </div>
  )
}
