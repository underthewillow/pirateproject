import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { useData } from '../../context/DataContext'
import { Draggable, Droppable } from '../common/Dnd'
import Editable from '../common/Editable'

export default function InventoryTab() {
  const { inventory, settings, addItem, patchItem, removeItem, canEdit } = useData()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const cargoNames = settings?.cargo_names || {}
  const CONTAINERS = [
    { id: 'cargo_1', title: cargoNames.cargo_1 || 'Fore Cargo Hold', hint: 'Heavy stores & plunder.' },
    { id: 'cargo_2', title: cargoNames.cargo_2 || 'Aft Cargo Hold', hint: 'More stowage below decks.' },
    { id: 'party', title: 'Party Inventory', hint: 'Carried by the crew.' },
  ]

  const onDragEnd = ({ active, over }) => {
    if (!over) return
    const container = over.data.current?.container
    if (container && active.data.current?.container !== container) {
      patchItem('inventory', active.id, { container })
    }
  }

  const addTo = async (container) => {
    const name = prompt('Item name')
    if (!name) return
    await addItem('inventory', { name, container, quantity: 1, sort_order: inventory.length + 1 })
  }

  return (
    <div>
      <h2 className="section-title">Inventory & Cargo</h2>
      <p className="muted">Drag items between the holds and the party's packs.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 12 }}>
          {CONTAINERS.map((c) => {
            const items = inventory.filter((it) => it.container === c.id)
            const totalWeight = items.reduce((s, it) => s + (Number(it.weight) || 0) * (Number(it.quantity) || 1), 0)
            return (
              <div key={c.id}>
                <div className="row-between">
                  <div className="dropzone-label">📦 {c.title}</div>
                  {canEdit && <button className="btn small ghost" onClick={() => addTo(c.id)}>+ item</button>}
                </div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  {c.hint} · {items.length} items · {totalWeight} wt
                </div>
                <Droppable id={c.id} data={{ container: c.id }} className="dropzone" >
                  <div className="list">
                    {items.length === 0 && <span className="role-empty">— empty —</span>}
                    {items.map((it) => (
                      <Draggable key={it.id} id={it.id} data={{ container: it.container }} disabled={!canEdit}>
                        <div className="card">
                          <div className="row-between">
                            <strong className="grow">
                              <Editable value={it.name} onCommit={(v) => patchItem('inventory', it.id, { name: v })} />
                            </strong>
                            <span className="muted flex gap-sm" style={{ alignItems: 'center' }}>
                              ×<Editable type="number" value={it.quantity} onCommit={(v) => patchItem('inventory', it.id, { quantity: v })} />
                              {canEdit && (
                                <button className="btn small danger" onClick={() => removeItem('inventory', it.id)}>✕</button>
                              )}
                            </span>
                          </div>
                          <div className="muted" style={{ fontSize: 14 }}>
                            <Editable value={it.description} placeholder="describe it…" onCommit={(v) => patchItem('inventory', it.id, { description: v })} />
                          </div>
                          {canEdit && (
                            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                              weight ea: <Editable type="number" value={it.weight} onCommit={(v) => patchItem('inventory', it.id, { weight: v })} />
                            </div>
                          )}
                        </div>
                      </Draggable>
                    ))}
                  </div>
                </Droppable>
              </div>
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}
