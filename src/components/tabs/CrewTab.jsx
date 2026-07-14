import { useState } from 'react'
import { useData } from '../../context/DataContext'
import CrewCard from '../common/CrewCard'
import CharacterModal from '../common/CharacterModal'

const ZONES = [
  { id: 'ship', title: 'Aboard the Ship', icon: '⚓', note: 'Hands currently sailing with us.' },
  { id: 'passenger', title: 'Passengers', icon: '🧳', note: 'Temporary guests aboard — they can’t stay overnight or long rest on the ship.' },
  { id: 'met', title: 'The Gangplank', icon: '🪜', note: 'Newly met souls — not yet crew, passengers, or sent on their way. A place to stage arrivals and hold the undecided.' },
  { id: 'shore', title: 'Ashore', icon: '🏝️', note: 'Off the ship — in port or elsewhere.' },
  { id: 'available', title: 'Available Crew', icon: '🛟', note: 'Reserve hands. Tap a hand’s station badge to post them.' },
]
const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]))

export default function CrewTab() {
  const { crew, ship, patchItem, addItem, canEdit } = useData()
  const caps = { ship: ship?.ship_data?.crewMax ?? 14, passenger: ship?.ship_data?.passengerMax ?? 5 }
  const [openId, setOpenId] = useState(null)
  const [moveId, setMoveId] = useState(null) // crew member whose station menu is open

  const addCrew = async () => {
    const name = prompt('New crew member name')
    if (!name) return
    // New characters start hidden from the crew so the DM can flesh them out
    // and reveal them deliberately. Toggle "Hidden from crew" off in the sheet
    // (or hit "Reveal to crew") when they should appear.
    const member = await addItem('crew', { name, location: 'available', sort_order: crew.length + 1, stats: { hidden: true } })
    setOpenId(member.id)
  }

  const move = (m, zoneId) => {
    if (zoneId !== m.location) patchItem('crew', m.id, { location: zoneId })
    setMoveId(null)
  }

  const openMember = crew.find((c) => c.id === openId)

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <div>
          <h2 className="section-title">The Crew</h2>
          <p className="muted" style={{ margin: 0 }}>Click a hand to open their sheet. Tap the station badge (⚓, 🏝️, …) on a card to move them.</p>
        </div>
        {canEdit && <button className="btn brass" onClick={addCrew}>+ Add crew</button>}
      </div>

      <div className="panel-grid" style={{ gap: 18 }}>
        {ZONES.map((z) => {
          const members = crew.filter((c) => c.location === z.id)
          return (
            <div key={z.id} className="dropzone">
              <div className="row-between">
                <div className="dropzone-label" style={caps[z.id] != null && members.length > caps[z.id] ? { color: 'var(--wax-red)' } : undefined}>
                  {z.icon} {z.title} · {members.length}{caps[z.id] != null ? ` / ${caps[z.id]}` : ''}
                </div>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: -4, marginBottom: 10 }}>{z.note}</div>
              <div className="crew-cards">
                {members.length === 0 && <span className="role-empty">— empty —</span>}
                {members.map((m) => {
                  const here = ZONE_BY_ID[m.location] || ZONES[0]
                  return (
                    // Anyone — players and the DM alike — can reorganise the
                    // roster by re-stationing a hand from its station badge.
                    <div key={m.id} className="crew-card-wrap">
                      <CrewCard member={m} onOpen={() => setOpenId(m.id)} />
                      <button
                        className="crew-move-btn"
                        title={`${here.title} — tap to move`}
                        aria-label={`Station: ${here.title}. Tap to move.`}
                        onClick={() => setMoveId((id) => (id === m.id ? null : m.id))}
                      >{here.icon}</button>
                      {moveId === m.id && (
                        <div className="crew-move-menu" role="menu">
                          {ZONES.map((zz) => (
                            <button
                              key={zz.id}
                              className={`crew-move-opt ${zz.id === m.location ? 'current' : ''}`}
                              onClick={() => move(m, zz.id)}
                            >
                              <span className="crew-move-opt-icon">{zz.icon}</span>
                              {zz.title}
                              {zz.id === m.location && ' ✓'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* click-away closer for the station menu */}
      {moveId && <div className="crew-move-backdrop" onClick={() => setMoveId(null)} />}

      {openMember && <CharacterModal member={openMember} onClose={() => setOpenId(null)} />}
    </div>
  )
}
