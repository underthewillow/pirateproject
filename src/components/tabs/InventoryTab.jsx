import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { useData } from '../../context/DataContext'
import { Draggable, Droppable } from '../common/Dnd'
import Editable from '../common/Editable'
import Modal from '../common/Modal'

// Default daily appetite when a soul has no custom rate set on their sheet.
const DEFAULT_PER_DAY = 1

// Provision kinds and their display language. `need` is the per-character stat
// key (set on the character sheet) that says how much of this each soul wants.
const KINDS = {
  food: { emoji: '🍖', unit: 'rations', each: 'rations each', need: 'rations_per_day' },
  drink: { emoji: '🍷', unit: 'cups', each: 'cups each', need: 'drinks_per_day' },
}

const dayColor = (d) =>
  d === Infinity ? undefined : d <= 0 ? 'var(--wax-red)' : d < 2 ? '#b5892b' : undefined
const showDays = (d) => (d === Infinity ? '∞' : d)

const uid = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(16).slice(2)}`

// Starter goods offered when the DM first stocks an empty market. Everything is
// editable afterwards, so these are only a convenient starting point.
const STARTER_GOODS = [
  { name: 'Salted Pork', provision: 'food', servings: 1, cost: 2 },
  { name: 'Hardtack Biscuit', provision: 'food', servings: 1, cost: 1 },
  { name: 'Crate of Fresh Fruit', provision: 'food', servings: 6, cost: 10 },
  { name: 'Barrel of Ale', provision: 'drink', servings: 24, cost: 15 },
  { name: 'Bottle of Rum', provision: 'drink', servings: 4, cost: 8 },
  { name: 'Cask of Fresh Water', provision: 'drink', servings: 20, cost: 3 },
]

export default function InventoryTab() {
  const { inventory, crew, settings, addItem, patchItem, removeItem, setSetting, canEdit } = useData()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [adding, setAdding] = useState(null) // { container } while the add-item dialog is open
  const [marketOpen, setMarketOpen] = useState(false)
  const [marketAttempt, setMarketAttempt] = useState('')
  const [marketErr, setMarketErr] = useState(false)
  const [buyQty, setBuyQty] = useState({}) // per-good purchase quantity, keyed by good id

  const cargoNames = settings?.cargo_names || {}
  const CONTAINERS = [
    { id: 'ship', title: 'Ship’s Stores', hint: 'Provisions and shipboard supplies.' },
    { id: 'cargo_1', title: cargoNames.cargo_1 || 'Fore Cargo Hold', hint: 'Heavy stores & plunder.' },
    { id: 'cargo_2', title: cargoNames.cargo_2 || 'Aft Cargo Hold', hint: 'More stowage below decks.' },
    { id: 'party', title: 'Party Inventory', hint: 'Carried by the crew.' },
  ]

  // ---- provisions ----
  // Souls that must be fed: everyone Aboard the Ship plus Passengers (see the Crew tab).
  const souls = crew.filter((c) => c.location === 'ship' || c.location === 'passenger')
  const mouths = souls.length
  // Each soul's daily appetite is set on their character sheet; default to 1 apiece.
  const dailyNeed = (statKey) =>
    souls.reduce((sum, c) => {
      const raw = c?.stats?.[statKey]
      const n = raw == null || raw === '' ? DEFAULT_PER_DAY : Number(raw)
      return sum + (Number.isFinite(n) && n >= 0 ? n : DEFAULT_PER_DAY)
    }, 0)
  const needFood = dailyNeed('rations_per_day')
  const needDrink = dailyNeed('drinks_per_day')
  const voyageDay = Number(settings?.voyage_day) || 0
  // Servings already drawn from a partially-opened unit, keyed by item id.
  const opened = settings?.provisions_open || {}

  const perUnit = (it) => Math.max(1, Number(it.servings) || 1)
  // Servings still in the barrel/crate, accounting for any opened unit.
  const servingsLeft = (it) =>
    Math.max(0, (Number(it.quantity) || 0) * perUnit(it) - (Number(opened[it.id]) || 0))

  const kindItems = (kind) => inventory.filter((it) => it.provision === kind)
  const totalServings = (kind) => kindItems(kind).reduce((s, it) => s + servingsLeft(it), 0)
  const rations = totalServings('food')
  const cups = totalServings('drink')

  const daysFor = (servings, need) =>
    need > 0 ? Math.floor(servings / need) : servings > 0 ? Infinity : 0
  const daysFood = daysFor(rations, needFood)
  const daysDrink = daysFor(cups, needDrink)

  // Draw `need` servings from the items of a kind, mutating `openedDraft`.
  // Finishes already-open units first, then the smallest containers, so nothing
  // is wasted. Returns the quantity patches to persist and any shortfall.
  const drawDown = (kind, need, openedDraft) => {
    let remaining = need
    const patches = []
    const items = kindItems(kind)
      .filter((it) => servingsLeft(it) > 0)
      .sort((a, b) => {
        const aOpen = (openedDraft[a.id] || 0) > 0 ? 0 : 1
        const bOpen = (openedDraft[b.id] || 0) > 0 ? 0 : 1
        if (aOpen !== bOpen) return aOpen - bOpen
        return perUnit(a) - perUnit(b)
      })
    for (const it of items) {
      if (remaining <= 0) break
      const per = perUnit(it)
      const qty = Number(it.quantity) || 0
      const usedOpen = Number(openedDraft[it.id]) || 0
      const avail = qty * per - usedOpen
      const take = Math.min(remaining, avail)
      remaining -= take
      const consumedInOpen = usedOpen + take
      const unitsDone = Math.floor(consumedInOpen / per)
      patches.push({ id: it.id, quantity: qty - unitsDone })
      const rem = consumedInOpen - unitsDone * per
      if (rem > 0) openedDraft[it.id] = rem
      else delete openedDraft[it.id]
    }
    return { patches, shortfall: remaining }
  }

  const advanceDay = async () => {
    if (mouths <= 0) return alert('No souls aboard to feed.')
    if (!confirm(`Advance one day at sea? The crew will consume ${needFood} ration(s) and ${needDrink} cup(s) of drink.`))
      return
    // Prune stale opened-unit entries for items that no longer exist.
    const openedDraft = {}
    for (const it of inventory) if (opened[it.id] != null) openedDraft[it.id] = opened[it.id]

    const food = drawDown('food', needFood, openedDraft)
    const drink = drawDown('drink', needDrink, openedDraft)

    await Promise.all(
      [...food.patches, ...drink.patches].map((p) => patchItem('inventory', p.id, { quantity: p.quantity }))
    )
    await setSetting('provisions_open', openedDraft)
    await setSetting('voyage_day', voyageDay + 1)

    if (food.shortfall > 0 || drink.shortfall > 0) {
      const parts = []
      if (food.shortfall > 0) parts.push(`${food.shortfall} ration(s) short on food`)
      if (drink.shortfall > 0) parts.push(`${drink.shortfall} cup(s) short on drink`)
      alert(`⚠ The stores ran dry — ${parts.join(' and ')}. The crew goes hungry!`)
    }
  }

  const onDragEnd = ({ active, over }) => {
    if (!over) return
    const container = over.data.current?.container
    if (container && active.data.current?.container !== container) patchItem('inventory', active.id, { container })
  }
  const addTo = (container) =>
    setAdding({ container, name: '', provision: '', servings: 1, quantity: 1 })

  const submitAdd = async (e) => {
    e.preventDefault()
    const name = adding.name.trim()
    if (!name) return
    const provision = adding.provision || null
    await addItem('inventory', {
      name,
      container: adding.container,
      quantity: Math.max(1, Number(adding.quantity) || 1),
      provision,
      servings: provision ? Math.max(1, Number(adding.servings) || 1) : 1,
      sort_order: inventory.length + 1,
    })
    setAdding(null)
  }

  const setProvision = (it, value) => {
    const patch = { provision: value || null }
    if (value && (it.servings == null || Number(it.servings) < 1)) patch.servings = 1
    patchItem('inventory', it.id, patch)
  }

  // ---- provisions market ----
  const marketItems = Array.isArray(settings?.market_items) ? settings.market_items : []
  const marketPass = settings?.market_passphrase

  const tryOpenMarket = (e) => {
    e.preventDefault()
    // The DM (edit unlocked) always gets in; otherwise the market password gates it.
    if (canEdit || marketPass == null || String(marketAttempt) === String(marketPass)) {
      setMarketOpen(true); setMarketErr(false); setMarketAttempt('')
    } else setMarketErr(true)
  }

  const saveGoods = (next) => setSetting('market_items', next)
  const updateGood = (id, patch) => saveGoods(marketItems.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const addGood = () => saveGoods([...marketItems, { id: uid(), name: 'New good', provision: '', servings: 1, cost: 1 }])
  const removeGood = (id) => saveGoods(marketItems.filter((g) => g.id !== id))
  const stockStarters = () => saveGoods([...marketItems, ...STARTER_GOODS.map((g) => ({ ...g, id: uid() }))])

  const buyGood = async (g) => {
    const qty = Math.max(1, Number(buyQty[g.id]) || 1)
    const cost = Math.max(0, Number(g.cost) || 0) * qty
    if (!confirm(`Buy ${qty} × ${g.name} for ${cost} gp? This adds it to the Ship’s Stores and records a market expense in the ledger.`))
      return
    const provision = g.provision || null
    const servings = provision ? Math.max(1, Number(g.servings) || 1) : 1
    // Stack onto a matching item already in the Ship's Stores, else add a new one.
    const existing = inventory.find(
      (it) =>
        it.container === 'ship' &&
        (it.name || '').trim().toLowerCase() === (g.name || '').trim().toLowerCase() &&
        (it.provision || null) === provision &&
        perUnit(it) === servings
    )
    if (existing) await patchItem('inventory', existing.id, { quantity: (Number(existing.quantity) || 0) + qty })
    else
      await addItem('inventory', {
        name: g.name,
        container: 'ship',
        quantity: qty,
        provision,
        servings,
        sort_order: inventory.length + 1,
      })
    await addItem('ledger', {
      description: `Market — ${g.name}${qty > 1 ? ` ×${qty}` : ''}`,
      amount: -cost,
      category: 'Market',
    })
  }

  return (
    <div>
      <h2 className="section-title">Inventory & Cargo</h2>

      {/* Provisions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between">
          <span className="eyebrow">Provisions · Day {voyageDay}</span>
          <div className="flex gap-sm" style={{ alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>
              consuming {needFood} ration{needFood !== 1 ? 's' : ''} + {needDrink} cup{needDrink !== 1 ? 's' : ''} per day
            </span>
            {canEdit && <button className="btn brass small" onClick={advanceDay}>☀ Advance the Day</button>}
          </div>
        </div>
        <div className="sb-combat" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', margin: '10px 0 4px' }}>
          <div className="sb-stat"><div className="sb-stat-num">{mouths}</div><div className="sb-stat-lbl">Mouths to Feed</div></div>
          <div className="sb-stat"><div className="sb-stat-num">{rations}</div><div className="sb-stat-lbl">🍖 Rations</div></div>
          <div className="sb-stat"><div className="sb-stat-num" style={{ color: dayColor(daysFood) }}>{showDays(daysFood)}</div><div className="sb-stat-lbl">Days of Food</div></div>
          <div className="sb-stat"><div className="sb-stat-num">{cups}</div><div className="sb-stat-lbl">🍷 Drink (cups)</div></div>
          <div className="sb-stat"><div className="sb-stat-num" style={{ color: dayColor(daysDrink) }}>{showDays(daysDrink)}</div><div className="sb-stat-lbl">Days of Drink</div></div>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
          Each soul’s daily ration and drink needs are set on their character sheet (1 each by default). Mark an item’s
          type below and its servings to have it counted here.
          {(daysFood <= 1 || daysDrink <= 1) && (
            <strong style={{ color: 'var(--wax-red)' }}>
              {' '}Stores are running dangerously low
              {daysFood <= 1 && daysDrink > 1 ? ' on food' : daysDrink <= 1 && daysFood > 1 ? ' on drink' : ''} —
              reprovision at port.
            </strong>
          )}
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
                    {items.map((it) => {
                      const kind = KINDS[it.provision]
                      return (
                      <Draggable key={it.id} id={it.id} data={{ container: it.container }} disabled={!canEdit}>
                        <div className="card">
                          <div className="row-between">
                            <strong className="grow">
                              {kind ? kind.emoji + ' ' : ''}
                              <Editable value={it.name} onCommit={(v) => patchItem('inventory', it.id, { name: v })} />
                            </strong>
                            <span className="muted flex gap-sm" style={{ alignItems: 'center' }}>
                              ×<Editable type="number" value={it.quantity} onCommit={(v) => patchItem('inventory', it.id, { quantity: v })} />
                              {canEdit && <button className="btn small danger" onClick={() => removeItem('inventory', it.id)}>✕</button>}
                            </span>
                          </div>

                          {canEdit && (
                            <div className="flex gap-sm" style={{ alignItems: 'center', margin: '6px 0 2px', flexWrap: 'wrap' }}>
                              <select
                                className="select"
                                style={{ width: 'auto' }}
                                value={it.provision || ''}
                                onChange={(e) => setProvision(it, e.target.value)}
                              >
                                <option value="">🎒 Equipment</option>
                                <option value="food">🍖 Food</option>
                                <option value="drink">🍷 Drink</option>
                              </select>
                              {kind && (
                                <span className="muted flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                                  <Editable type="number" value={it.servings ?? 1} onCommit={(v) => patchItem('inventory', it.id, { servings: v })} />
                                  {kind.each}
                                </span>
                              )}
                            </div>
                          )}

                          {kind && (
                            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                              {servingsLeft(it)} {kind.unit} in store
                              {(Number(opened[it.id]) || 0) > 0 && ` · ${perUnit(it) - opened[it.id]} left in the open ${it.provision === 'drink' ? 'barrel' : 'crate'}`}
                            </div>
                          )}

                          <div className="muted" style={{ fontSize: 14 }}>
                            <Editable value={it.description} placeholder="describe it…" onCommit={(v) => patchItem('inventory', it.id, { description: v })} />
                          </div>
                        </div>
                      </Draggable>
                      )
                    })}
                  </div>
                </Droppable>
              </div>
            )
          })}
        </div>
      </DndContext>

      {/* Provisions Market */}
      <div style={{ marginTop: 26 }}>
        <div className="sb-section-title">🏪 Provisions Market</div>
        {!marketOpen ? (
          <div className="card">
            <p style={{ margin: '0 0 10px' }}>
              Make port at a town with a market — Saltmarsh, say — to buy food and drink for the voyage.
            </p>
            <form className="toolbar" onSubmit={tryOpenMarket}>
              <input
                className="input"
                type="password"
                style={{ maxWidth: 220 }}
                placeholder={canEdit ? 'market password (or just enter)' : 'market password'}
                value={marketAttempt}
                onChange={(e) => { setMarketAttempt(e.target.value); setMarketErr(false) }}
              />
              <button className="btn brass" type="submit">Enter market</button>
            </form>
            {marketErr && <p style={{ color: 'var(--wax-red)', marginTop: 8, marginBottom: 0 }}>The market’s closed to you. (Wrong password.)</p>}
            {canEdit && (
              <div style={{ marginTop: 12 }}>
                <label className="eyebrow">Market password (players enter this to shop)</label>
                <Editable
                  value={marketPass}
                  placeholder="no password — open to all"
                  onCommit={(v) => setSetting('market_passphrase', v)}
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="eyebrow">Goods for sale</span>
              <div className="flex gap-sm">
                {canEdit && <button className="btn small ghost" onClick={addGood}>+ Add good</button>}
                <button className="btn small ghost" onClick={() => setMarketOpen(false)}>Leave market</button>
              </div>
            </div>
            <div className="list">
              {marketItems.length === 0 && (
                <div className="card">
                  <span className="muted">No goods stocked here yet.</span>
                  {canEdit && (
                    <div style={{ marginTop: 8 }}>
                      <button className="btn small brass" onClick={stockStarters}>Stock starter goods</button>
                    </div>
                  )}
                </div>
              )}
              {marketItems.map((g) => {
                const kind = KINDS[g.provision]
                const qty = Math.max(1, Number(buyQty[g.id]) || 1)
                return (
                  <div className="card" key={g.id}>
                    <div className="row-between">
                      <strong className="grow">
                        {kind ? kind.emoji + ' ' : ''}
                        {canEdit
                          ? <Editable value={g.name} onCommit={(v) => updateGood(g.id, { name: v })} />
                          : g.name}
                      </strong>
                      <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                        <span className="coin gold" title="cost each">{Number(g.cost) || 0}</span>
                        <span className="muted" style={{ fontSize: 13 }}>gp each</span>
                      </span>
                    </div>

                    {canEdit ? (
                      <div className="flex gap-sm" style={{ alignItems: 'center', margin: '6px 0', flexWrap: 'wrap' }}>
                        <select
                          className="select"
                          style={{ width: 'auto' }}
                          value={g.provision || ''}
                          onChange={(e) => updateGood(g.id, { provision: e.target.value, servings: e.target.value ? (g.servings || 1) : (g.servings ?? 1) })}
                        >
                          <option value="">🎒 Equipment</option>
                          <option value="food">🍖 Food</option>
                          <option value="drink">🍷 Drink</option>
                        </select>
                        {kind && (
                          <span className="muted flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                            <Editable type="number" value={g.servings ?? 1} onCommit={(v) => updateGood(g.id, { servings: v })} /> {kind.each}
                          </span>
                        )}
                        <span className="muted flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                          cost <Editable type="number" value={g.cost ?? 0} onCommit={(v) => updateGood(g.id, { cost: v })} /> gp
                        </span>
                        <button className="btn small danger" onClick={() => removeGood(g.id)}>remove</button>
                      </div>
                    ) : (
                      kind && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{g.servings ?? 1} {kind.unit} each</div>
                    )}

                    <div className="flex gap-sm" style={{ alignItems: 'center', marginTop: 8 }}>
                      <span className="muted" style={{ fontSize: 13 }}>qty</span>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        style={{ width: 70 }}
                        value={buyQty[g.id] ?? 1}
                        onChange={(e) => setBuyQty((m) => ({ ...m, [g.id]: e.target.value }))}
                      />
                      <button className="btn brass small" onClick={() => buyGood(g)}>
                        Buy for {(Number(g.cost) || 0) * qty} gp
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Purchases land in the Ship’s Stores and record the cost as a ledger expense.
              {canEdit && ' Edit names, types, servings, and costs above to balance the economy.'}
            </p>
          </div>
        )}
      </div>

      {adding && (
        <Modal onClose={() => setAdding(null)}>
          <h2 className="section-title">Add an item</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            To {CONTAINERS.find((c) => c.id === adding.container)?.title || 'the hold'}.
          </p>
          <form onSubmit={submitAdd} className="list" style={{ marginTop: 12 }}>
            <div>
              <label className="eyebrow">Name</label>
              <input
                className="input"
                autoFocus
                value={adding.name}
                placeholder="e.g. Barrel of Rum"
                onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))}
              />
            </div>
            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              <div className="grow">
                <label className="eyebrow">Type</label>
                <select
                  className="select"
                  value={adding.provision}
                  onChange={(e) => setAdding((a) => ({ ...a, provision: e.target.value }))}
                >
                  <option value="">🎒 Equipment</option>
                  <option value="food">🍖 Food</option>
                  <option value="drink">🍷 Drink</option>
                </select>
              </div>
              <div style={{ width: 90 }}>
                <label className="eyebrow">Quantity</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={adding.quantity}
                  onChange={(e) => setAdding((a) => ({ ...a, quantity: e.target.value }))}
                />
              </div>
              {KINDS[adding.provision] && (
                <div style={{ width: 130 }}>
                  <label className="eyebrow">{KINDS[adding.provision].each}</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={adding.servings}
                    onChange={(e) => setAdding((a) => ({ ...a, servings: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="toolbar" style={{ marginTop: 8 }}>
              <button className="btn brass" type="submit" disabled={!adding.name.trim()}>Add to hold</button>
              <button className="btn ghost" type="button" onClick={() => setAdding(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
