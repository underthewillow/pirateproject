import { useData } from '../../context/DataContext'
import { assetUrl } from '../../lib/asset'
import Avatar from './Avatar'
import Editable from './Editable'
import Modal from './Modal'
import DiceRoller, { abilityMod } from './DiceRoller'
import StatBlock from './StatBlock'
import NpcStatBlock from './NpcStatBlock'
import { RANK_KEYS, rankKey, rankLabel } from '../../lib/ranks'

const LOCATIONS = [
  { value: 'ship', label: 'On the Ship' },
  { value: 'passenger', label: 'Passenger' },
  { value: 'shore', label: 'Ashore' },
  { value: 'available', label: 'Available (reserve)' },
]

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const ABIL_LOOKUP = new Set([
  'str', 'dex', 'con', 'int', 'wis', 'cha',
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
])
// Kept in the stats blob but surfaced with their own controls, not the free-form list.
const RESERVED_STATS = new Set(['rations_per_day', 'drinks_per_day', 'rank', 'condition'])
const DEFAULT_PER_DAY = 1

export default function CharacterModal({ member, onClose }) {
  const { patchItem, removeItem, addRole, removeRole, roles, canEdit } = useData()
  if (!member) return null

  const stats = member.stats && typeof member.stats === 'object' ? member.stats : {}
  const memberRoles = Array.isArray(member.roles) ? member.roles : []
  const setStats = (next) => patchItem('crew', member.id, { stats: next })

  // Crew standing (rank) + condition. Anyone may promote; only the DM demotes.
  const rk = rankKey(member)
  const rkIdx = RANK_KEYS.indexOf(rk)
  const promote = () => { if (rkIdx < RANK_KEYS.length - 1) setStats({ ...stats, rank: RANK_KEYS[rkIdx + 1] }) }
  const demote = () => { if (rkIdx > 0) setStats({ ...stats, rank: RANK_KEYS[rkIdx - 1] }) }
  const promoteLabel = rk === 'passenger' ? 'Sign on as recruit' : 'Ink the Black Knot ⚓'

  // Non-ability stats (Race, Class, …) for the general list; abilities and the
  // reserved provision fields get their own controls.
  const generalStats = Object.entries(stats).filter(
    ([k]) => !ABIL_LOOKUP.has(k.trim().toLowerCase()) && !RESERVED_STATS.has(k.trim().toLowerCase())
  )

  const addStat = () => {
    const name = prompt('Stat name (e.g. AC, HP, Speed, Proficiency)')
    if (name) setStats({ ...stats, [name]: '' })
  }
  const abilityValue = (abbr) => {
    for (const k of Object.keys(stats)) if (k.trim().toLowerCase() === abbr.toLowerCase()) return stats[k]
    return ''
  }
  const setAbility = (abbr, val) => setStats({ ...stats, [abbr]: val })

  return (
    <Modal onClose={onClose}>
      <div className="flex gap" style={{ alignItems: 'center' }}>
        <Avatar member={member} size="lg" />
        <div className="grow">
          <div className="flex gap-sm" style={{ alignItems: 'center' }}>
            <Editable
              as="h2"
              className="section-title"
              value={member.name}
              onCommit={(v) => patchItem('crew', member.id, { name: v })}
            />
            <span className={`badge ${member.is_pc ? 'main' : 'side'}`}>{member.is_pc ? 'Player' : 'NPC'}</span>
          </div>
          <Editable
            as="div"
            className="eyebrow"
            placeholder="add a title / epithet"
            value={member.title}
            onCommit={(v) => patchItem('crew', member.id, { title: v })}
          />
        </div>
      </div>

      {member.portrait_url && (
        <a href={assetUrl(member.portrait_url)} target="_blank" rel="noreferrer" className="portrait-frame" title="Open full image">
          <img src={assetUrl(member.portrait_url)} alt={member.name} loading="lazy" />
          <span className="portrait-hint">⤢ open full {member.is_pc ? 'reference sheet' : 'image'}</span>
        </a>
      )}

      {member.stats?.condition && (
        <div className="condition-banner">⛓ {member.stats.condition}</div>
      )}

      <hr className="rule" />

      {!member.is_pc && (
        <div style={{ marginBottom: 14 }}>
          <label className="eyebrow">Standing aboard</label>
          <div className="flex wrap gap-sm" style={{ alignItems: 'center', marginTop: 6 }}>
            <span className={`npc-rank big rank-${rk}`}>{rankLabel(rk)}</span>
            {rk !== 'crew' && <button className="btn small brass" onClick={promote}>{promoteLabel}</button>}
            {canEdit && rk !== 'passenger' && <button className="btn small ghost" onClick={demote} title="Lower standing">▾ demote</button>}
          </div>
          {rk === 'recruit' && <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>Ink the Black Knot to make them full crew — the tattoo is the initiation.</p>}
          <div style={{ marginTop: 10 }}>
            <label className="eyebrow">Condition</label>
            <Editable
              value={member.stats?.condition}
              placeholder="hale — note a condition (e.g. incapacitated, poisoned)…"
              onCommit={(v) => setStats({ ...stats, condition: v })}
            />
          </div>
        </div>
      )}

      <div>
        <label className="eyebrow">Whereabouts</label>
        {canEdit ? (
          <select
            className="select"
            style={{ maxWidth: 260 }}
            value={member.location}
            onChange={(e) => patchItem('crew', member.id, { location: e.target.value })}
          >
            {LOCATIONS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        ) : (
          <div>{LOCATIONS.find((l) => l.value === member.location)?.label}</div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="eyebrow">Daily provisions</label>
        {canEdit ? (
          <div className="flex gap-sm" style={{ marginTop: 6, flexWrap: 'wrap' }}>
            <span className="flex gap-sm" style={{ alignItems: 'center' }}>
              🍖
              <input
                className="input"
                type="number"
                min="0"
                style={{ width: 70 }}
                value={stats.rations_per_day ?? DEFAULT_PER_DAY}
                onChange={(e) => setStats({ ...stats, rations_per_day: e.target.value })}
              />
              rations/day
            </span>
            <span className="flex gap-sm" style={{ alignItems: 'center' }}>
              🍷
              <input
                className="input"
                type="number"
                min="0"
                style={{ width: 70 }}
                value={stats.drinks_per_day ?? DEFAULT_PER_DAY}
                onChange={(e) => setStats({ ...stats, drinks_per_day: e.target.value })}
              />
              cups/day
            </span>
          </div>
        ) : (
          <div className="muted">
            🍖 {stats.rations_per_day ?? DEFAULT_PER_DAY} rations/day · 🍷 {stats.drinks_per_day ?? DEFAULT_PER_DAY} cups/day
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="eyebrow">Roles aboard</label>
        <div className="flex wrap gap-sm" style={{ marginTop: 6 }}>
          {canEdit ? (
            roles.map((r) => {
              const on = memberRoles.includes(r.name)
              return (
                <button
                  key={r.id}
                  className={`role-chip ${on ? 'on' : ''}`}
                  onClick={() => (on ? removeRole(member.id, r.name) : addRole(member.id, r.name))}
                >
                  {on ? '✓ ' : ''}{r.name}
                </button>
              )
            })
          ) : memberRoles.length ? (
            memberRoles.map((n) => <span key={n} className="badge main">{n}</span>)
          ) : (
            <span className="muted">none</span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="eyebrow">Log entry / bio</label>
        <Editable
          as="p"
          multiline
          placeholder="Write what's known of this soul…"
          value={member.bio}
          onCommit={(v) => patchItem('crew', member.id, { bio: v })}
        />
      </div>

      {member.sheet_data ? (
        member.is_pc ? <StatBlock member={member} /> : <NpcStatBlock member={member} />
      ) : (
        <>
          {(member.is_pc || ABILITIES.some((a) => abilityValue(a) !== '')) && (
            <div style={{ marginTop: 14 }}>
              <label className="eyebrow">Ability scores</label>
              <div className="ability-grid" style={{ marginTop: 6 }}>
                {ABILITIES.map((a) => {
                  const v = abilityValue(a)
                  return (
                    <div className="ability" key={a}>
                      <div className="ability-abbr">{a}</div>
                      {canEdit ? (
                        <input
                          className="input ability-input"
                          type="number"
                          value={v}
                          placeholder="—"
                          onChange={(e) => setAbility(a, e.target.value)}
                        />
                      ) : (
                        <div className="ability-score">{v === '' ? '—' : v}</div>
                      )}
                      <div className="ability-mod">{v === '' ? '' : (abilityMod(v) >= 0 ? `+${abilityMod(v)}` : abilityMod(v))}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <div className="row-between">
              <label className="eyebrow">Details & stats</label>
              {canEdit && <button className="btn small ghost" onClick={addStat}>+ stat</button>}
            </div>
            <div className="list" style={{ marginTop: 8 }}>
              {generalStats.length === 0 && <span className="muted">No details recorded.</span>}
              {generalStats.map(([k, v]) => (
                <div className="row-between card" key={k}>
                  <strong>{k}</strong>
                  <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                    <Editable value={v} onCommit={(nv) => setStats({ ...stats, [k]: nv })} placeholder="—" />
                    {canEdit && (
                      <button
                        className="btn small danger"
                        onClick={() => { const n = { ...stats }; delete n[k]; setStats(n) }}
                      >✕</button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <hr className="rule" />
          <DiceRoller member={member} />
        </>
      )}

      {(member.sheet_url || canEdit) && (
        <div style={{ marginTop: 14 }}>
          <label className="eyebrow">D&D Beyond sheet</label>
          {canEdit ? (
            <Editable
              value={member.sheet_url}
              placeholder="paste the character's D&D Beyond share link"
              onCommit={(v) => patchItem('crew', member.id, { sheet_url: v })}
            />
          ) : (
            <div><a href={member.sheet_url} target="_blank" rel="noreferrer">Open on D&D Beyond ↗</a></div>
          )}
        </div>
      )}

      {canEdit && (
        <>
          <hr className="rule" />
          <div className="panel-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="eyebrow">Icon image URL</label>
              <Editable
                value={member.image_url}
                placeholder="crew/icons/name.jpg or a link"
                onCommit={(v) => patchItem('crew', member.id, { image_url: v })}
              />
            </div>
            <div>
              <label className="eyebrow">Portrait image URL</label>
              <Editable
                value={member.portrait_url}
                placeholder="crew/portraits/name.jpg or a link"
                onCommit={(v) => patchItem('crew', member.id, { portrait_url: v })}
              />
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <label className="flex gap-sm" style={{ alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={!!member.is_pc}
                onChange={(e) => patchItem('crew', member.id, { is_pc: e.target.checked })}
              />
              Player character
            </label>
            <span className="flex gap-sm" style={{ alignItems: 'center' }}>
              <span className="muted">token colour</span>
              <input
                type="color"
                value={member.color || '#6b4a2b'}
                onChange={(e) => patchItem('crew', member.id, { color: e.target.value })}
                style={{ width: 48, height: 30, background: 'none', border: 'none' }}
              />
            </span>
          </div>
          <div className="toolbar" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <button
              className="btn danger"
              onClick={() => { if (confirm(`Remove ${member.name} from the roster?`)) { removeItem('crew', member.id); onClose() } }}
            >Remove from roster</button>
            <button className="btn brass" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
  )
}
