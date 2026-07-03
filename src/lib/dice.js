// Shared dice helpers used by the quick roller and the character stat block.
export const rollDie = (sides) => Math.floor(Math.random() * sides) + 1
export const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`)
export const abilityMod = (score) => Math.floor((Number(score) - 10) / 2)

// Parse "2d6+3", "d20-1", "1d8 + 2" → {total, detail} (null if unparseable).
export function parseExpr(expr) {
  const terms = String(expr).replace(/\s+/g, '').match(/[+-]?(\d*d\d+|\d+)/gi)
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

// A d20 check with a flat modifier and optional advantage/disadvantage.
export function rollD20(modifier = 0, mode = 'normal') {
  let base, note = ''
  if (mode !== 'normal') {
    const a = rollDie(20), b = rollDie(20)
    base = mode === 'adv' ? Math.max(a, b) : Math.min(a, b)
    note = ` (${mode === 'adv' ? 'adv' : 'dis'} ${a}/${b})`
  } else base = rollDie(20)
  const m = Number(modifier) || 0
  return {
    base,
    total: base + m,
    detail: `d20[${base}]${note}${m ? ' ' + fmt(m) : ''}`,
    crit: base === 20,
    fumble: base === 1,
  }
}
