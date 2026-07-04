import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { useData } from '../../context/DataContext'
import { Draggable, Droppable } from '../common/Dnd'
import Editable from '../common/Editable'

export default function InventoryTab() {
  const { inventory, crew, settings, addItem, patchItem, removeItem, canEdit } = useData()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const cargoNames = settings?.cargo_names || {}
  const CONTAINERS = [
    { id: 'ship', title: 'Ship’s Stores', hint: 'Provisions and shipboard supplies.' },
    { id: 'cargo_1', title: cargoNames.cargo_1 || 'Fore Cargo Hold', hint: 'Heavy stores & plunder.' },
    { id: 'cargo_2', title: cargoNames.cargo_2 || 'Aft Cargo Hold', hint: 'More stowage below decks.' },
    { id: 'party', title: 'Party Inventory', hint: 'Carried by the crew.' },
  ]

  // ---- provisions ----
  const mouths = crew.filter((c) => c.location === 'ship' || c.location === 'passenger').length
  const totalOf = (kind) => inventory.filter((it) => it.provision === kind)
    .reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.servings) || 1), 0)
  const rations = totalOf('food')
  const cups = totalOf('drink')
  const daysOf = (n) => (mouths > 0 ? Math.floor(n / mouths) : n > 0 ? 99 : 0)
  const days = Math.min(daysOf(rations), daysOf(cups))
  const dayColor = days <= 0 ? 'var(--wax-red)' : days < 2 ? '#b5892b' : undefined

  const onDragEnd = ({ active, over }) => {
    if (!over) return
    const container = over.data.current?.container
    if (container && active.data.current?.container !== container) patchItem('inventory', active.id, { container })
  }
  const addTo = async (container) => {
    const name = prompt('Item name')
    if (name) await addItem('inventory', { name, container, quantity: 1, sort_order: inventory.length + 1 })
  }

  return (
    <div>
      <h2 className="section-title">Inventory & Cargo</h2>

      {/* Provisions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between">
          <span className="eyebrow">Provisions</span>
          <span className="muted" style={{ fontSize: 13 }}>1 ration + 1 cup of drink per soul, per day</span>
        </div>
        <div className="sb-combat" style={{ gridTemplateColumns: 'repeat(4, 1fr)', margin: '10px 0 4px' }}>
          <div className="sb-stat"><div className="sb-stat-num">{mouths}</div><div className="sb-stat-lbl">Mouths to Feed</div></div>
          <div className="sb-stat"><div className="sb-stat-num">{rations}</div><div className="sb-stat-lbl">Salt Pork (rations)</div></div>
          <div className="sb-stat"><div className="sb-stat-num">{cups}</div><div className="sb-stat-lbl">Drink (cups)</div></div>
          <div className="sb-stat"><div className="sb-stat-num" style={{ color: dayColor }}>{days}</div><div className="sb-stat-lbl">Days of Supply</div></div>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
          Every crew member and passenger needs at least 1 ration of salted pork and 1 cup of alcoholic drink each day.
          {days <= 1 && <strong style={{ color: 'var(--wax-red)' }}> Stores are running dangerously low — reprovision at port.</strong>}
        </p>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>Drag items between the holds and the party’s packs.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: 12 }}>
          {CONTAINERS.map((c) => {
            const items = inventory.filter((it) => it.container === c.id)
            return (
              <div key={c.id}>
                <div className="row-between">
                  <div className="dropzone-label">📦 {c.title}</div>
                  {canEdit && <button className="btn small ghost" onClick={() => addTo(c.id)}>+ item</button>}
                </div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{c.hint} · {items.length} items</div>
                <Droppable id={c.id} data={{ container: c.id }} className="dropzone">
                  <div className="list">
                    {items.length === 0 && <span className="role-empty">— empty —</span>}
                    {items.map((it) => (
                      <Draggable key={it.id} id={it.id} data={{ container: it.container }} disabled={!canEdit}>
                        <div className="card">
                          <div className="row-between">
                            <strong className="grow">
                              {it.provision === 'food' && '🍖 '}{it.provision === 'drink' && '🍷 '}
                              <Editable value={it.name} onCommit={(v) => patchItem('inventory', it.id, { name: v })} />
                            </strong>
                            <span className="muted flex gap-sm" style={{ alignItems: 'center' }}>
                              ×<Editable type="number" value={it.quantity} onCommit={(v) => patchItem('inventory', it.id, { quantity: v })} />
                              {canEdit && <button className="btn small danger" onClick={() => removeItem('inventory', it.id)}>✕</button>}
                            </span>
                          </div>
                          {it.provision === 'drink' && (
                            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                              <Editable type="number" value={it.servings} onCommit={(v) => patchItem('inventory', it.id, { servings: v })} /> cups each
                            </div>
                          )}
                          <div className="muted" style={{ fontSize: 14 }}>
                            <Editable value={it.description} placeholder="describe it…" onCommit={(v) => patchItem('inventory', it.id, { description: v })} />
                          </div>
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
