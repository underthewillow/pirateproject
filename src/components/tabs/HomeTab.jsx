import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { assetUrl } from '../../lib/asset'
import CharacterModal from '../common/CharacterModal'
import { rankKey, rankLabel } from '../../lib/ranks'

const hpColor = (pct) => (pct > 0.5 ? '#3a7a4a' : pct > 0.25 ? '#c08a2c' : '#a3352f')
const num = (v) => Number(v) || 0

export default function HomeTab({ onNavigate }) {
  const { ship, crew, inventory, ledger, funds, quests, journal, settings, canEdit } = useData()
  const [openId, setOpenId] = useState(null)
  const go = (tab) => onNavigate && onNavigate(tab)

  const sd = ship?.ship_data || {}
  // The Helm is the "who's actually with us" board: hidden/staged characters
  // and those off elsewhere (ashore, reserve, on the gangplank) don't count
  // toward the ship's tallies or clutter the roster.
  const visible = crew.filter((c) => !c.stats?.hidden)
  const pcs = visible.filter((c) => c.is_pc)
  const npcs = visible.filter((c) => !c.is_pc && (c.location === 'ship' || c.location === 'passenger'))
  const aboard = visible.filter((c) => c.location === 'ship').length
  const pax = visible.filter((c) => c.location === 'passenger').length
  const crewMax = sd.crewMax ?? 14
  const paxMax = sd.passengerMax ?? 5

  // ship hull
  const shipHp = num(sd.hpCurrent), shipHpMax = num(sd.hpMax) || 1
  const shipPct = Math.max(0, Math.min(1, shipHp / shipHpMax))

  // provisions — only the crew actually aboard draw on the ship's stores;
  // passengers and other categories aren't counted, nor are hidden/staged souls.
  const mouths = visible.filter((c) => c.location === 'ship').length
  const totalOf = (kind) => inventory.filter((it) => it.provision === kind)
    .reduce((s, it) => s + num(it.quantity) * (num(it.servings) || 1), 0)
  const rations = totalOf('food'), cups = totalOf('drink')
  const daysOf = (n) => (mouths > 0 ? Math.floor(n / mouths) : n > 0 ? 99 : 0)
  const days = Math.min(daysOf(rations), daysOf(cups))

  // funds
  const purse = funds || { gold: 0, silver: 0, copper: 0 }
  const ledgerTotal = ledger.reduce((s, e) => s + num(e.amount), 0)

  // quests
  const activeQuests = quests.filter((q) => q.status === 'active')
  const mainQuests = activeQuests.filter((q) => q.type === 'main')

  // journal (newest)
  const latestEntry = [...journal].sort((a, b) => {
    const an = a.session_no ?? -Infinity, bn = b.session_no ?? -Infinity
    if (an !== bn) return bn - an
    return (a.created_at || '') < (b.created_at || '') ? 1 : -1
  })[0]

  // map
  const charted = Array.isArray(settings?.charted_regions) ? settings.charted_regions : []

  // ---- things that need attention ----
  const alerts = []
  if (shipHpMax && shipPct <= 0.5)
    alerts.push({ level: shipPct <= 0.25 ? 'crit' : 'warn', icon: '⚓', tab: 'ship', text: `The hull is ${shipPct <= 0.25 ? 'nearly wrecked' : 'battered'} — ${shipHp}/${shipHpMax} HP. Put in for repairs.` })
  if (num(sd.speedCurrent) < num(sd.speedMax))
    alerts.push({ level: 'warn', icon: '⛵', tab: 'ship', text: `Sails are torn — speed ${sd.speedCurrent}/${sd.speedMax}. Mend them at a shipyard.` })
  // wounded or incapacitated crew — players and NPCs alike (hidden/staged
  // characters never raise Helm alerts)
  visible.forEach((m) => {
    const cond = m.stats?.condition
    if (cond) { alerts.push({ level: 'crit', icon: '⛓', tab: 'crew', mid: m.id, text: `${m.name} is incapacitated — ${cond}.` }); return }
    const s = m.sheet_data; if (!s) return
    const cur = num(s.hpCurrent ?? s.maxHp), mx = num(s.maxHp) || 1
    const pct = cur / mx
    if (pct <= 0.5) alerts.push({ level: pct <= 0.25 ? 'crit' : 'warn', icon: '🩸', tab: 'crew', mid: m.id, text: `${m.name} is ${pct <= 0.25 ? 'gravely wounded' : 'wounded'} — ${cur}/${mx} HP.` })
  })
  if (days <= 2) alerts.push({ level: days <= 0 ? 'crit' : 'warn', icon: '🍖', tab: 'inventory', text: days <= 0 ? 'Stores are empty — the crew goes hungry.' : `Provisions run low — ${days} day${days === 1 ? '' : 's'} of supply left.` })
  if (aboard > crewMax) alerts.push({ level: 'warn', icon: '☠', tab: 'crew', text: `Overcrowded — ${aboard} hands aboard, berths for ${crewMax}.` })
  if (pax > paxMax) alerts.push({ level: 'warn', icon: '☠', tab: 'crew', text: `Too many passengers — ${pax} aboard, room for ${paxMax}.` })
  if (ledgerTotal < -0.5) alerts.push({ level: 'warn', icon: '🪙', tab: 'funds', text: `The ledger is in the red — ${Math.round(ledgerTotal)} gp.` })

  const openMember = crew.find((c) => c.id === openId)
  const openAlert = (a) => { if (a.mid) setOpenId(a.mid); else go(a.tab) }

  return (
    <div className="dash">
      <div className="dash-hero">
        <button className="dash-hero-id" onClick={() => go('ship')} title="Open the ship">
          <div className="eyebrow">Captain's Log</div>
          <h2 className="section-title" style={{ margin: '2px 0 2px' }}>{ship?.name || 'The Ship'}</h2>
          <div className="muted" style={{ fontStyle: 'italic' }}>{ship?.tagline || 'Fair winds and full sails.'}</div>
        </button>
        <div className="dash-hero-right">
          <button className="dash-treasure" onClick={() => go('funds')} title="Open the ledger">
            <span className="gp-coin" />
            <span className="dash-treasure-txt">
              <span className="amt">{num(purse.gold).toLocaleString()}<span className="gp"> gp</span></span>
              <span className="lbl">in the coffers</span>
              <span className="sub">{num(purse.silver)} silver · {num(purse.copper)} copper</span>
            </span>
          </button>
          <div className="dash-hero-stats">
            <button className="dash-hero-stat" onClick={() => go('crew')} title="Open the crew roster"><div className="n">{pcs.length}</div><div className="l">crew of note</div></button>
            <button className="dash-hero-stat" onClick={() => go('crew')} title="Open the crew roster"><div className="n">{aboard}</div><div className="l">hands aboard</div></button>
            <button className="dash-hero-stat" onClick={() => go('quests')} title="Open the posterboard"><div className="n">{activeQuests.length}</div><div className="l">active quests</div></button>
          </div>
        </div>
      </div>

      {/* RPG party panel */}
      <div className="dash-sec-title">The Party <span className="muted">— tap a hero for their sheet</span></div>
      <div className="hero-party">
        {pcs.map((m) => {
          const s = m.sheet_data || {}
          const cur = num(s.hpCurrent ?? s.maxHp), mx = num(s.maxHp) || 1
          const pct = Math.max(0, Math.min(1, cur / mx))
          const classShort = (s.classLine || '').replace(/\s*\(.*\)\s*/, '') || '—'
          const portrait = m.image_url || m.portrait_url // icon = clean headshot
          const roles = Array.isArray(m.roles) ? m.roles : []
          return (
            <button key={m.id} className={`hero-card ${pct <= 0.5 ? 'hurt' : ''}`} onClick={() => setOpenId(m.id)} title={s.classLine || m.name}>
              <div className="hero-portrait" style={portrait ? { backgroundImage: `url("${assetUrl(portrait)}")` } : { background: m.color || '#6b4a2b' }}>
                {!portrait && <span className="hero-initials">{(m.name || '?').slice(0, 2)}</span>}
                {s.level != null && <span className="hero-lvl">Lv {s.level}</span>}
                {s.ac != null && <span className="hero-ac" title="Armor Class">🛡 {s.ac}</span>}
              </div>
              <div className="hero-body">
                <div className="hero-name">{m.name}</div>
                <div className="hero-class muted">{classShort}</div>
                <div className="hero-hpbar"><span className="hero-hpfill" style={{ width: `${pct * 100}%`, background: hpColor(pct) }} /></div>
                <div className="hero-hpnum" style={{ color: hpColor(pct) }}>{cur} <span className="muted">/ {mx} HP</span></div>
                {roles.length > 0 && <div className="hero-roles">{roles.map((r) => <span key={r} className="hero-chip">{r}</span>)}</div>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Ship's company (NPC hands) */}
      {npcs.length > 0 && (
        <>
          <div className="dash-sec-title">Ship's Company <span className="muted">— {npcs.length} hands</span></div>
          <div className="npc-fleet">
            {npcs.map((m) => {
              const s = m.sheet_data || {}
              const mx = num(s.maxHp)
              const cur = num(s.hpCurrent ?? s.maxHp)
              const pct = mx ? Math.max(0, Math.min(1, cur / mx)) : 1
              const cond = m.stats?.condition
              const hidden = !!m.stats?.hidden
              const rk = rankKey(m)
              const portrait = m.image_url || m.portrait_url
              return (
                <button key={m.id} className={`npc-mini ${hidden ? 'concealed' : ''} ${cond ? 'downed' : (mx && pct <= 0.5 ? 'hurt' : '')}`} onClick={() => setOpenId(m.id)} title={hidden ? `${m.name} — hidden from crew` : cond ? `${m.name} — ${cond}` : m.name}>
                  <div className="npc-mini-portrait" style={portrait ? { backgroundImage: `url("${assetUrl(portrait)}")` } : { background: m.color || '#6b4a2b' }}>
                    {s.level != null && <span className="npc-mini-lvl">Lv {s.level}</span>}
                    {s.ac != null && <span className="npc-mini-ac">🛡 {s.ac}</span>}
                    {hidden && <span className="npc-mini-hide" title="Hidden from the crew">🎭</span>}
                    {cond && <span className="npc-mini-flag" title={cond}>⛓</span>}
                  </div>
                  <div className="npc-mini-body">
                    <div className="npc-mini-name">{m.name}</div>
                    <div className={`npc-rank rank-${rk}`}>{rankLabel(rk)}</div>
                    {mx > 0 && !cond && (
                      <>
                        <div className="npc-mini-hpbar"><span style={{ width: `${pct * 100}%`, background: hpColor(pct) }} /></div>
                        <div className="npc-mini-hp" style={{ color: hpColor(pct) }}>{cur} <span className="muted">/ {mx}</span></div>
                      </>
                    )}
                    {cond && <div className="npc-mini-cond">⛓ {cond}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Summary cards */}
      <div className="dash-sec-title">At a Glance</div>
      <div className="dash-grid">
        <button className="dash-card" onClick={() => go('ship')}>
          <div className="dash-card-head"><span className="dash-card-ic">⚓</span> The Ship</div>
          <div className="dash-hpbar big"><span style={{ width: `${shipPct * 100}%`, background: hpColor(shipPct) }} /></div>
          <div className="dash-card-num" style={{ color: hpColor(shipPct) }}>{shipHp} <span className="muted" style={{ fontSize: 15 }}>/ {shipHpMax} hull</span></div>
          <div className="dash-card-sub muted">Speed {sd.speedCurrent ?? sd.speedMax}/{sd.speedMax} · AC {sd.ac} · {aboard}/{crewMax} crew</div>
        </button>

        <button className="dash-card" onClick={() => go('inventory')}>
          <div className="dash-card-head"><span className="dash-card-ic">🍖</span> Provisions</div>
          <div className="dash-card-num" style={{ color: days <= 2 ? hpColor(days / 4) : undefined }}>{days} <span className="muted" style={{ fontSize: 15 }}>days of supply</span></div>
          <div className="dash-card-sub muted">{rations} rations · {cups} cups · {mouths} mouths to feed</div>
        </button>

        <button className="dash-card" onClick={() => go('funds')}>
          <div className="dash-card-head"><span className="dash-card-ic">🪙</span> Funds</div>
          <div className="dash-card-num">{num(purse.gold).toLocaleString()} <span className="muted" style={{ fontSize: 15 }}>gp</span></div>
          <div className="dash-card-sub muted">{num(purse.silver)} silver · {num(purse.copper)} copper · ledger {ledgerTotal >= 0 ? '+' : ''}{Math.round(ledgerTotal)} gp</div>
        </button>

        <button className="dash-card" onClick={() => go('quests')}>
          <div className="dash-card-head"><span className="dash-card-ic">📜</span> Posterboard</div>
          <div className="dash-card-num">{activeQuests.length} <span className="muted" style={{ fontSize: 15 }}>active quests</span></div>
          <div className="dash-card-sub muted">
            {mainQuests.slice(0, 3).map((q) => <span key={q.id} className="dash-quest">◆ {q.title}</span>)}
            {mainQuests.length === 0 && 'No main quests afoot.'}
          </div>
        </button>

        <button className="dash-card" onClick={() => go('map')}>
          <div className="dash-card-head"><span className="dash-card-ic">🗺</span> The Chart</div>
          <div className="dash-card-num">{charted.length} <span className="muted" style={{ fontSize: 15 }}>regions charted</span></div>
          <div className="dash-card-sub muted">Sailing the Sea of Swords · fog yet to lift over the rest.</div>
        </button>

        <button className="dash-card" onClick={() => go('journal')}>
          <div className="dash-card-head"><span className="dash-card-ic">📖</span> Journal</div>
          <div className="dash-card-num" style={{ fontSize: 20, fontFamily: 'var(--font-display)' }}>{latestEntry ? latestEntry.title : 'No entries yet'}</div>
          <div className="dash-card-sub muted">{latestEntry ? `Latest of ${journal.length} · Session ${latestEntry.session_no ?? '—'}` : 'The tale begins soon.'}</div>
        </button>
      </div>

      {/* Needs attention — moved below the roster & summary so the log leads with the crew */}
      <div className="dash-sec-title">Needs Attention</div>
      <div className="dash-alerts">
        {alerts.length === 0 ? (
          <div className="dash-alert calm">⚓ All's well aboard — fair winds and a sound hull.</div>
        ) : (
          alerts.map((a, i) => (
            <button key={i} className={`dash-alert ${a.level}`} onClick={() => openAlert(a)}>
              <span className="dash-alert-ic">{a.icon}</span>
              <span>{a.text}</span>
              <span className="dash-alert-go">›</span>
            </button>
          ))
        )}
      </div>

      {!canEdit && <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>You'll need admin or DM access to edit any of these. Tap a card to dive into that section.</p>}

      {openMember && <CharacterModal member={openMember} onClose={() => setOpenId(null)} />}
    </div>
  )
}
