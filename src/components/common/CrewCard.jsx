import { assetUrl } from '../../lib/asset'
import { rankKey, rankLabel } from '../../lib/ranks'

const hpColor = (pct) => (pct > 0.5 ? '#3a7a4a' : pct > 0.25 ? '#c08a2c' : '#a3352f')
const num = (v) => Number(v) || 0

// A compact character card for the Crew board — the Helm's stat-card look, a
// size down, and draggable between stations. Serves both players and NPCs:
// players show their class, NPCs show their crew standing. Reuses the Helm's
// npc-mini-* badge/HP styles so the two boards read as one system.
export default function CrewCard({ member, onOpen }) {
  const s = member.sheet_data || {}
  const mx = num(s.maxHp)
  const cur = num(s.hpCurrent ?? s.maxHp)
  const pct = mx ? Math.max(0, Math.min(1, cur / mx)) : 1
  const cond = member.stats?.condition
  const hidden = !!member.stats?.hidden
  const isPc = !!member.is_pc
  const rk = rankKey(member)
  const classShort = (s.classLine || '').replace(/\s*\(.*\)\s*/, '')
  const portrait = member.image_url || member.portrait_url
  return (
    <div
      className={`crew-card ${hidden ? 'concealed' : ''} ${cond ? 'downed' : (mx && pct <= 0.5 ? 'hurt' : '')}`}
      onClick={() => onOpen?.(member)}
      title={hidden ? `${member.name} — hidden from crew` : cond ? `${member.name} — ${cond}` : member.name}
    >
      <div
        className="crew-card-portrait"
        style={portrait ? { backgroundImage: `url("${assetUrl(portrait)}")` } : { background: member.color || '#6b4a2b' }}
      >
        {!portrait && <span className="crew-card-initials">{(member.name || '?').slice(0, 2)}</span>}
        {s.level != null && <span className="npc-mini-lvl">Lv {s.level}</span>}
        {s.ac != null && <span className="npc-mini-ac">🛡 {s.ac}</span>}
        {isPc && <span className="crew-card-star" title="Player character">★</span>}
        {hidden && <span className="npc-mini-hide" title="Hidden from the crew">🎭</span>}
        {cond && <span className="npc-mini-flag" title={cond}>⛓</span>}
      </div>
      <div className="crew-card-body">
        <div className="npc-mini-name">{member.name}</div>
        {isPc
          ? (classShort ? <div className="crew-card-class muted">{classShort}</div> : null)
          : <div className={`npc-rank rank-${rk}`}>{rankLabel(rk)}</div>}
        {mx > 0 && !cond && (
          <>
            <div className="npc-mini-hpbar"><span style={{ width: `${pct * 100}%`, background: hpColor(pct) }} /></div>
            <div className="npc-mini-hp" style={{ color: hpColor(pct) }}>{cur} <span className="muted">/ {mx}</span></div>
          </>
        )}
        {cond && <div className="npc-mini-cond">⛓ {cond}</div>}
      </div>
    </div>
  )
}
