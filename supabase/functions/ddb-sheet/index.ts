// Supabase Edge Function: ddb-sheet
// Fetches a public D&D Beyond character and normalizes it into the app's
// sheet_data shape. Runs server-side (no browser CORS limit on the D&D Beyond
// call) and returns permissive CORS so the app can call it directly.
//
// GET/POST  ?id=<dndbeyond character id>
// Returns:  { ok, sheet } or { ok:false, error }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const j = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const ABBR = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const STATN = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const SKILLS: [string, string, string][] = [
  ['Acrobatics', 'acrobatics', 'DEX'], ['Animal Handling', 'animal-handling', 'WIS'],
  ['Arcana', 'arcana', 'INT'], ['Athletics', 'athletics', 'STR'], ['Deception', 'deception', 'CHA'],
  ['History', 'history', 'INT'], ['Insight', 'insight', 'WIS'], ['Intimidation', 'intimidation', 'CHA'],
  ['Investigation', 'investigation', 'INT'], ['Medicine', 'medicine', 'WIS'], ['Nature', 'nature', 'INT'],
  ['Perception', 'perception', 'WIS'], ['Performance', 'performance', 'CHA'], ['Persuasion', 'persuasion', 'CHA'],
  ['Religion', 'religion', 'INT'], ['Sleight of Hand', 'sleight-of-hand', 'DEX'], ['Stealth', 'stealth', 'DEX'],
  ['Survival', 'survival', 'WIS'],
]
const ALIGN: Record<number, string> = {
  1: 'Lawful Good', 2: 'Neutral Good', 3: 'Chaotic Good', 4: 'Lawful Neutral', 5: 'True Neutral',
  6: 'Chaotic Neutral', 7: 'Lawful Evil', 8: 'Neutral Evil', 9: 'Chaotic Evil',
}
const mod = (s: number) => Math.floor((s - 10) / 2)
const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

function normalize(d: any) {
  const allMods: any[] = ([] as any[]).concat(...Object.values(d.modifiers || {}).map((v: any) => v || []))
  const equippedIds = new Set((d.inventory || []).filter((i: any) => i.equipped).map((i: any) => i.definition?.id))
  const modActive = (m: any) =>
    m.componentId == null || m.componentId === undefined || !('componentId' in m) ||
    // race/class/feat/background mods have no inventory component; item mods must be equipped
    (m.entityTypeId !== 2103445194 && m.entityTypeId !== 1439) || equippedIds.has(m.componentId)

  // ---- ability scores ----
  const base = [0, 1, 2, 3, 4, 5].map((i) => d.stats?.[i]?.value ?? 10)
  const over = [0, 1, 2, 3, 4, 5].map((i) => d.overrideStats?.[i]?.value ?? null)
  const bonusStat = [0, 1, 2, 3, 4, 5].map((i) => d.bonusStats?.[i]?.value ?? 0)
  const scores: Record<string, number> = {}
  ABBR.forEach((ab, i) => {
    let sc = base[i] + (bonusStat[i] || 0)
    for (const m of allMods) {
      if (m.type === 'bonus' && m.subType === `${STATN[i]}-score`) sc += m.value || 0
    }
    let setVal = 0
    for (const m of allMods) if (m.type === 'set' && m.subType === `${STATN[i]}-score`) setVal = Math.max(setVal, m.value || 0)
    if (over[i] != null) sc = over[i]
    else if (setVal) sc = Math.max(sc, setVal)
    scores[ab] = sc
  })
  const mods: Record<string, number> = {}
  ABBR.forEach((ab) => (mods[ab] = mod(scores[ab])))

  // ---- level / prof ----
  const classes = d.classes || []
  const totalLevel = classes.reduce((s: number, c: any) => s + (c.level || 0), 0) || 1
  const pb = Math.ceil(totalLevel / 4) + 1
  const primary = (classes.find((c: any) => c.isStartingClass) || classes[0])?.definition?.name || ''

  // ---- saves ----
  const saveProf: Record<string, boolean> = {}
  ABBR.forEach((ab, i) => {
    saveProf[ab] = allMods.some((m) => m.type === 'proficiency' && m.subType === `${STATN[i]}-saving-throws`)
  })

  // ---- skills ----
  const jackOfAll = allMods.some((m) => m.type === 'half-proficiency' && m.subType === 'ability-checks')
  const skills = SKILLS.map(([name, slug, ab]) => {
    const p = allMods.some((m) => m.type === 'proficiency' && m.subType === slug)
    const e = allMods.some((m) => m.type === 'expertise' && m.subType === slug)
    let m = mods[ab] + (e ? pb * 2 : p ? pb : jackOfAll ? Math.floor(pb / 2) : 0)
    return { n: name, a: ab, m, p, e }
  })
  const passivePerception = 10 + (skills.find((s) => s.n === 'Perception')!.m)

  // ---- hp ----
  const conMod = mods['CON']
  let maxHp = (d.baseHitPoints || 0) + conMod * totalLevel + (d.bonusHitPoints || 0)
  for (const m of allMods) if (m.type === 'bonus' && m.subType === 'hit-points-per-level' && modActive(m)) maxHp += (m.value || 0) * totalLevel
  if (d.overrideHitPoints != null) maxHp = d.overrideHitPoints
  const hpCurrent = Math.max(0, maxHp - (d.removedHitPoints || 0))

  // ---- ac ----
  const inv = d.inventory || []
  const dexMod = mods['DEX']
  let ac = 10 + dexMod
  const armor = inv.find((i: any) => i.equipped && i.definition?.armorTypeId && i.definition.armorTypeId <= 3)
  const shield = inv.find((i: any) => i.equipped && i.definition?.armorTypeId === 4)
  if (armor) {
    const b = armor.definition.armorClass || 10
    const t = armor.definition.armorTypeId
    ac = t === 1 ? b + dexMod : t === 2 ? b + Math.min(2, dexMod) : b
  } else if (primary === 'Monk') ac = 10 + dexMod + mods['WIS']
  else if (primary === 'Barbarian') ac = 10 + dexMod + mods['CON']
  if (shield) ac += shield.definition.armorClass || 2
  for (const m of allMods) if (m.type === 'bonus' && (m.subType === 'armor-class' || m.subType === 'unarmored-armor-class') && modActive(m)) ac += m.value || 0

  // ---- speed ----
  let speed = d.race?.weightSpeeds?.normal?.walk ?? 30
  if (primary === 'Monk') { const t = [0, 0, 10, 10, 10, 10, 15, 15, 15, 15, 20, 20, 20, 20, 25, 25, 25, 25, 30, 30][totalLevel] || 0; speed += t }

  // ---- senses ----
  const senses: string[] = []
  if (allMods.some((m) => m.subType === 'darkvision')) senses.push('Darkvision 60 ft')

  // ---- attacks ----
  const attacks: any[] = []
  for (const it of inv) {
    const def = it.definition
    if (!def || def.filterType !== 'Weapon') continue
    const props: string[] = (def.properties || []).map((p: any) => p.name)
    const ranged = def.attackType === 2 || def.range > 5
    const finesse = props.includes('Finesse')
    const ab = ranged ? 'DEX' : finesse ? (mods['DEX'] >= mods['STR'] ? 'DEX' : 'STR') : 'STR'
    let magic = 0
    for (const m of def.grantedModifiers || []) if (m.type === 'bonus' && m.subType === 'magic') magic += m.value || 0
    const b = mods[ab] + magic
    const dice = def.damage?.diceString || '1'
    attacks.push({
      n: def.name, toHit: b + pb + magic - magic + (pb - pb), // placeholder replaced below
      _b: b, _magic: magic, dice, type: def.damageType || '', range: def.range ? `${def.range}${def.longRange ? '/' + def.longRange : ''} ft` : 'Melee',
      notes: props.filter((p) => ['Finesse', 'Thrown', 'Two-Handed', 'Ammunition', 'Versatile', 'Light', 'Heavy', 'Reach'].includes(p)).join(', '),
    })
  }
  // recompute toHit/dmg cleanly
  const finalAttacks = attacks.slice(0, 8).map((a) => {
    const toHit = a._b + pb
    const dmg = a.dice + (a._b > 0 ? `+${a._b}` : a._b < 0 ? `${a._b}` : '')
    return { n: a.n, toHit, dmg, type: a.type, range: a.range, notes: a.notes }
  })
  // monk unarmed
  if (primary === 'Monk') {
    const die = totalLevel >= 17 ? '1d10' : totalLevel >= 11 ? '1d8' : totalLevel >= 5 ? '1d6' : '1d4'
    const ab = mods['DEX'] >= mods['STR'] ? 'DEX' : 'STR'
    const b = mods[ab]
    finalAttacks.unshift({ n: 'Unarmed Strike (Martial Arts)', toHit: b + pb, dmg: die + (b > 0 ? `+${b}` : b < 0 ? `${b}` : ''), type: 'Bludgeoning', range: 'Melee', notes: 'Flurry/bonus attack' })
  }

  // ---- spellcasting ----
  let spell = null
  const casterAbil: Record<string, string> = { Bard: 'CHA', Cleric: 'WIS', Druid: 'WIS', Sorcerer: 'CHA', Warlock: 'CHA', Wizard: 'INT', Paladin: 'CHA', Ranger: 'WIS' }
  const cabil = casterAbil[primary]
  if (cabil) spell = { ability: cabil, saveDc: 8 + pb + mods[cabil], atk: pb + mods[cabil] }

  // ---- class line / alignment / hit dice ----
  const classLine = classes.map((c: any) => {
    const sub = c.subclassDefinition?.name
    return `${c.definition?.name} ${c.level}${sub ? ` (${sub})` : ''}`
  }).join(' / ')
  const byDie: Record<number, number> = {}
  for (const c of classes) { const hd = c.definition?.hitDice || 8; byDie[hd] = (byDie[hd] || 0) + c.level }
  const hitDice = Object.entries(byDie).map(([die, n]) => `${n}d${die}`).join(' + ')

  const abilities: Record<string, any> = {}
  ABBR.forEach((ab) => (abilities[ab] = { score: scores[ab], mod: mods[ab], save: mods[ab] + (saveProf[ab] ? pb : 0), saveProf: saveProf[ab] }))

  return {
    race: d.race?.fullName || d.race?.baseName || '',
    classLine, alignment: ALIGN[d.alignmentId] || '', level: totalLevel, profBonus: pb,
    abilities, ac, maxHp, hpCurrent, speed, initiative: dexMod, hitDice, passivePerception, senses,
    skills, attacks: finalAttacks, spell,
    syncedName: d.name || '',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = new URL(req.url)
    let id = url.searchParams.get('id')
    if (!id && req.method === 'POST') { try { id = (await req.json())?.id } catch { /* ignore */ } }
    if (!id) return j({ ok: false, error: 'missing id' }, 400)
    id = String(id).match(/\d+/)?.[0] || ''
    const r = await fetch(`https://character-service.dndbeyond.com/character/v5/character/${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    if (!r.ok) return j({ ok: false, error: `D&D Beyond returned ${r.status}. Is the character set to Public?` }, 502)
    const body = await r.json()
    if (!body?.data) return j({ ok: false, error: 'No character data (private character?)' }, 502)
    return j({ ok: true, sheet: normalize(body.data) })
  } catch (e) {
    return j({ ok: false, error: String(e) }, 500)
  }
})
