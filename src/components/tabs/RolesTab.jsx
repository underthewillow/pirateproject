import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { useData } from '../../context/DataContext'
import { Draggable, Droppable } from '../common/Dnd'
import CrewToken from '../common/CrewToken'
import CharacterModal from '../common/CharacterModal'

export default function RolesTab() {
  const { roles, crew, addRole, removeRole, canEdit } = useData()
  const [openId, setOpenId] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = ({ active, over }) => {
    if (!over) return
    const memberId = active.data.current?.memberId
    const role = over.data.current?.role
    if (memberId && role) addRole(memberId, role)
  }

  const rolesOf = (m) => (Array.isArray(m.roles) ? m.roles : [])
  const openMember = crew.find((c) => c.id === openId)

  return (
    <div>
      <h2 className="section-title">Crew Roles</h2>
      <p className="muted">
        Drag a hand from the roster onto any station to appoint them — the same person can hold several posts.
        Use the ✕ on a token to relieve them of just that station.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: 12 }}>
          {roles.map((r) => {
            const holders = crew.filter((c) => rolesOf(c).includes(r.name))
            return (
              <Droppable key={r.id} id={`role-${r.name}`} data={{ role: r.name }} className="role-slot">
                <div className="grow">
                  <div className="role-name">{r.name}</div>
                  <div className="role-desc">{r.description}</div>
                  <div className="flex wrap gap-sm" style={{ marginTop: 8 }}>
                    {holders.length === 0 && <span className="role-empty">— vacant —</span>}
                    {holders.map((m) => (
                      <div key={m.id} className="flex gap-sm" style={{ alignItems: 'center' }}>
                        <Draggable id={`slot-${r.name}-${m.id}`} data={{ memberId: m.id }} disabled={!canEdit}>
                          <CrewToken member={m} onOpen={() => setOpenId(m.id)} />
                        </Draggable>
                        {canEdit && (
                          <button
                            className="btn small danger"
                            title={`Relieve ${m.name} of ${r.name}`}
                            onClick={() => removeRole(m.id, r.name)}
                          >✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Droppable>
            )
          })}
        </div>

        <div style={{ marginTop: 22 }}>
          <div className="dropzone-label">Ship's Roster · {crew.length}  (drag anyone onto a station above)</div>
          <div className="dropzone">
            <div className="flex wrap gap-sm">
              {crew.length === 0 && <span className="role-empty">No crew on record.</span>}
              {crew.map((m) => (
                <Draggable key={m.id} id={`roster-${m.id}`} data={{ memberId: m.id }} disabled={!canEdit}>
                  <CrewToken member={m} onOpen={() => setOpenId(m.id)} showRole />
                </Draggable>
              ))}
            </div>
          </div>
        </div>
      </DndContext>

      {openMember && <CharacterModal member={openMember} onClose={() => setOpenId(null)} />}
    </div>
  )
}
