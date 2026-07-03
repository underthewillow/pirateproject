import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { useData } from '../../context/DataContext'
import { Draggable, Droppable } from '../common/Dnd'
import CrewToken from '../common/CrewToken'
import CharacterModal from '../common/CharacterModal'

export default function RolesTab() {
  const { roles, crew, patchItem, canEdit } = useData()
  const [openId, setOpenId] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = ({ active, over }) => {
    if (!over) return
    const role = over.data.current?.role ?? null // null = unassigned pool
    if (active.data.current?.role !== role) {
      patchItem('crew', active.id, { role })
    }
  }

  const unassigned = crew.filter((c) => !c.role)
  const openMember = crew.find((c) => c.id === openId)

  return (
    <div>
      <h2 className="section-title">Crew Roles</h2>
      <p className="muted">Drag a hand onto a station to appoint them. Drag them to the roster below to relieve them.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: 12 }}>
          {roles.map((r) => {
            const holders = crew.filter((c) => c.role === r.name)
            return (
              <Droppable key={r.id} id={`role-${r.name}`} data={{ role: r.name }} className="role-slot">
                <div className="grow">
                  <div className="row-between">
                    <span className="role-name">{r.name}</span>
                  </div>
                  <div className="role-desc">{r.description}</div>
                  <div className="flex wrap gap-sm" style={{ marginTop: 8 }}>
                    {holders.length === 0 && <span className="role-empty">— vacant —</span>}
                    {holders.map((m) => (
                      <Draggable key={m.id} id={m.id} data={{ role: m.role }} disabled={!canEdit}>
                        <CrewToken member={m} onOpen={() => setOpenId(m.id)} />
                      </Draggable>
                    ))}
                  </div>
                </div>
              </Droppable>
            )
          })}
        </div>

        <div style={{ marginTop: 22 }}>
          <div className="dropzone-label">Unassigned Roster · {unassigned.length}</div>
          <Droppable id="role-unassigned" data={{ role: null }} className="dropzone">
            <div className="flex wrap gap-sm">
              {unassigned.length === 0 && <span className="role-empty">Every hand has a station.</span>}
              {unassigned.map((m) => (
                <Draggable key={m.id} id={m.id} data={{ role: m.role }} disabled={!canEdit}>
                  <CrewToken member={m} onOpen={() => setOpenId(m.id)} />
                </Draggable>
              ))}
            </div>
          </Droppable>
        </div>
      </DndContext>

      {openMember && <CharacterModal member={openMember} onClose={() => setOpenId(null)} />}
    </div>
  )
}
