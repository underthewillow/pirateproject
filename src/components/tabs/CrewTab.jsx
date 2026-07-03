import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { useData } from '../../context/DataContext'
import { Draggable, Droppable } from '../common/Dnd'
import CrewToken from '../common/CrewToken'
import CharacterModal from '../common/CharacterModal'

const ZONES = [
  { id: 'ship', title: 'Aboard the Ship', note: 'Hands currently sailing with us.' },
  { id: 'shore', title: 'Ashore', note: 'Off the ship — in port or elsewhere.' },
  { id: 'available', title: 'Available Crew', note: 'Reserve hands. Drag them into a station above.' },
]

export default function CrewTab() {
  const { crew, patchItem, addItem, canEdit } = useData()
  const [openId, setOpenId] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragEnd = ({ active, over }) => {
    if (!over) return
    const zone = over.data.current?.zone
    if (zone && active.data.current?.location !== zone) {
      patchItem('crew', active.id, { location: zone })
    }
  }

  const addCrew = async () => {
    const name = prompt('New crew member name')
    if (!name) return
    const member = await addItem('crew', { name, location: 'available', sort_order: crew.length + 1 })
    setOpenId(member.id)
  }

  const openMember = crew.find((c) => c.id === openId)

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <div>
          <h2 className="section-title">The Crew</h2>
          <p className="muted" style={{ margin: 0 }}>Click a hand to open their sheet. Drag to move them between stations.</p>
        </div>
        {canEdit && <button className="btn brass" onClick={addCrew}>+ Add crew</button>}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="panel-grid" style={{ gap: 18 }}>
          {ZONES.map((z) => {
            const members = crew.filter((c) => c.location === z.id)
            return (
              <Droppable key={z.id} id={z.id} data={{ zone: z.id }} className="dropzone">
                <div className="row-between">
                  <div className="dropzone-label">{z.title} · {members.length}</div>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: -4, marginBottom: 10 }}>{z.note}</div>
                <div className="flex wrap gap-sm">
                  {members.length === 0 && <span className="role-empty">— empty —</span>}
                  {members.map((m) => (
                    <Draggable key={m.id} id={m.id} data={{ location: m.location }} disabled={!canEdit}>
                      <CrewToken member={m} onOpen={() => setOpenId(m.id)} />
                    </Draggable>
                  ))}
                </div>
              </Droppable>
            )
          })}
        </div>
      </DndContext>

      {openMember && <CharacterModal member={openMember} onClose={() => setOpenId(null)} />}
    </div>
  )
}
