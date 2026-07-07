import { useState, useMemo } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { useData } from '../../context/DataContext'
import { useAppAuth } from '../../context/AuthContext'
import { Draggable, Droppable } from '../common/Dnd'
import Editable from '../common/Editable'
import Modal from '../common/Modal'
import { CATALOG, CATALOG_BY_INDEX } from '../../data/catalog'
import { MERCHANT_TYPES, PORT_FLAIRS, MERCHANT_TYPE_KEYS, PORT_FLAIR_KEYS } from '../../data/market-config'

// A fresh merchant is stocked with a random assortment of goods from its type's
// categories; the DM can then add (from the whole catalog) or remove anything.
const SEED_SIZE = 8
const seedStock = (typeKey) => {
  const t = MERCHANT_TYPES[typeKey]
  if (!t) return []
  const pool = CATALOG.filter(
    (c) => t.categories.includes(c.category) && (!t.provisionOnly || c.category !== 'Provisions' || c.provision === t.provisionOnly)
  )
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(pool.length, SEED_SIZE)).map((c) => c.index)
}

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

// Round gp to the nearest copper so cp/sp priced goods don't show float noise.
const gp = (n) => Math.round((Number(n) || 0) * 100) / 100

// Coins as a compact string, e.g. "12g 3s 5c" (1 gp = 10 sp = 100 cp).
const coinStr = (p) => `${Number(p?.gold) || 0}g ${Number(p?.silver) || 0}s ${Number(p?.copper) || 0}c`

// Split a gp amount into whole coins { gold, silver, copper }, nearest copper.
const toCoins = (gpVal) => {
  let cp = Math.round((Number(gpVal) || 0) * 100)
  const gold = Math.floor(cp / 100); cp -= gold * 100
  const silver = Math.floor(cp / 10); cp -= silver * 10
  return { gold, silver, copper: cp }
}

// A gp amount as a text coin string, e.g. 0.02 → "2c", 1.5 → "1g 5s".
// Used where JSX can't go (confirm/alert dialogs).
const priceStr = (gpVal) => {
  const { gold, silver, copper } = toCoins(gpVal)
  const parts = []
  if (gold) parts.push(`${gold}g`)
  if (silver) parts.push(`${silver}s`)
  if (copper) parts.push(`${copper}c`)
  return parts.join(' ') || 'free'
}

// A gp amount rendered as mini coin discs — each denomination's count overlaid
// on a gold/silver/copper coin (e.g. 0.02 gp → a single copper coin marked "2").
function Price({ gp: gpVal }) {
  const { gold, silver, copper } = toCoins(gpVal)
  const coins = [['gold', gold], ['silver', silver], ['copper', copper]].filter(([, n]) => n > 0)
  if (!coins.length) return <span className="muted">free</span>
  return (
    <span className="price-coins">
      {coins.map(([kind, n]) => (
        <span key={kind} className={`coin tiny ${kind}`} title={kind}>{n}</span>
      ))}
    </span>
  )
}

// Spend `costCopper` from a { gold, silver, copper } purse, paying the smallest
// coins first and breaking one larger coin into change only when a smaller
// denomination runs short. Denominations are preserved — we never consolidate
// silver/copper upward into gold, so the crew keeps a real mix of currency.
const spendCoins = (purse, costCopper) => {
  let g = Number(purse?.gold) || 0
  let s = Number(purse?.silver) || 0
  let c = Number(purse?.copper) || 0
  let need = costCopper

  const takeC = Math.min(c, need); c -= takeC; need -= takeC
  if (need > 0) {
    const takeS = Math.min(s, Math.floor(need / 10)); s -= takeS; need -= takeS * 10
    if (need > 0 && s > 0) { s -= 1; c += 10; const t = Math.min(c, need); c -= t; need -= t }
  }
  if (need > 0) {
    const takeG = Math.min(g, Math.floor(need / 100)); g -= takeG; need -= takeG * 100
    if (need > 0 && g > 0) { g -= 1; const change = 100 - need; need = 0; s += Math.floor(change / 10); c += change % 10 }
  }
  return { gold: g, silver: s, copper: c, short: need }
}

export default function InventoryTab() {
  const {
    inventory, crew, settings, ports, merchants, marketGoods, funds,
    addItem, patchItem, removeItem, patchSingleton, setSetting, canEdit,
    isDM,
  } = useData()
  const { hasRole } = useAppAuth()
  // The ship's actual stores/cargo/party packs are crew business — any
  // crew_member can manage them. Port/merchant setup and pricing stay
  // DM/admin-only (isDM), same as before.
  const canManageInventory = canEdit || hasRole('crew_member')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [adding, setAdding] = useState(null) // { container } while the add-item dialog is open
  const [stockOpen, setStockOpen] = useState(false) // catalog picker modal
  const [stockSearch, setStockSearch] = useState('')
  const [buyQty, setBuyQty] = useState({}) // per-good purchase quantity, keyed by good key
  const [visitingPortId, setVisitingPortId] = useState('') // which port we're at ('' = none)
  const [selectedMerchantId, setSelectedMerchantId] = useState('')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [newMerchantType, setNewMerchantType] = useState('general')

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
  const currentPort = ports.find((p) => p.id === visitingPortId) || null
  const portMult = currentPort ? Number(currentPort.price_mult) || 1 : 1
  const portFlair = currentPort?.flair ? PORT_FLAIRS[currentPort.flair] : null
  // Locked ports are entirely hidden from crew (filtered out of the port
  // picker below) — the DM sees and can toggle every port regardless.
  const portLocked = !!(currentPort && currentPort.locked && !isDM)
  const visiblePorts = isDM ? ports : ports.filter((p) => !p.locked)
  const legacyGoods = Array.isArray(settings?.market_items) ? settings.market_items : []

  // Coin purse (Funds tab), reckoned in copper so we can spend fractional gp.
  const purse = funds || { gold: 0, silver: 0, copper: 0 }
  const purseCopper =
    (Number(purse.gold) || 0) * 100 + (Number(purse.silver) || 0) * 10 + (Number(purse.copper) || 0)

  const merchantsHere = merchants
    .filter((m) => m.port_id === visitingPortId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const currentMerchant = merchantsHere.find((m) => m.id === selectedMerchantId) || merchantsHere[0] || null
  const merchantType = currentMerchant ? MERCHANT_TYPES[currentMerchant.type] : null
  const merchantMult = currentMerchant ? Number(currentMerchant.price_mult) || 1 : 1
  const totalMult = portMult * merchantMult
  const merchantCats = merchantType?.categories || []

  // Wares this merchant sells: the items in its `stock` list + attached homebrew.
  const goods = useMemo(() => {
    if (!currentMerchant) return []
    const stock = Array.isArray(currentMerchant.stock) ? currentMerchant.stock : []
    const catalogWares = stock
      .map((idx) => CATALOG_BY_INDEX[idx])
      .filter(Boolean)
      .map((c) => ({
        key: `cat:${c.index}`, catalogIndex: c.index, name: c.name, category: c.category,
        provision: c.provision || null, servings: c.servings || 1, base: c.cost_gp,
        desc: c.desc, detail: c.detail, homebrew: false,
      }))
    const localWares = marketGoods
      .filter((g) => g.merchant_id === currentMerchant.id)
      .map((g) => ({
        key: `hb:${g.id}`, id: g.id, name: g.name,
        category: g.category || (g.provision ? 'Provisions' : 'Gear'),
        provision: g.provision || null,
        servings: Math.max(1, Number(g.servings) || 1), base: Number(g.cost) || 0,
        desc: g.description, homebrew: true, port_id: g.port_id, merchant_id: g.merchant_id,
      }))
    return [...localWares, ...catalogWares]
  }, [currentMerchant, marketGoods, visitingPortId])

  // Custom goods not attached to any merchant (e.g. legacy imports) — the DM can
  // assign them to a merchant or remove them; they're invisible until assigned.
  const unassignedGoods = marketGoods.filter((g) => !g.merchant_id)

  // Category chips reflect what this merchant actually carries.
  const presentCats = [...new Set(goods.map((g) => g.category))]
  const catChips = ['All', ...presentCats]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return goods.filter((g) => {
      if (catFilter !== 'All' && g.category !== catFilter) return false
      if (q && !`${g.name} ${g.desc || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [goods, search, catFilter])

  const DISPLAY_CAP = 80
  const shown = filtered.slice(0, DISPLAY_CAP)

  // ---- market editing (DM) ----
  const marketError = (e) =>
    alert(`Market action failed. If this is the first time, run supabase/schema/market.sql in the Supabase SQL editor to create the tables.\n\n${e?.message || e}`)

  const selectPort = (id) => { setVisitingPortId(id); setSelectedMerchantId(''); setCatFilter('All') }
  const selectMerchant = (id) => { setSelectedMerchantId(id); setCatFilter('All') }

  const createPort = async (flairKey) => {
    try {
      const flair = flairKey ? PORT_FLAIRS[flairKey] : null
      const port = await addItem('ports', {
        name: flair?.label || 'New Port',
        flair: flairKey || null,
        blurb: flair?.blurb || '',
        price_mult: flair?.price_mult ?? 1,
        sort_order: ports.length + 1,
        locked: true, // hidden from crew until the DM unlocks it — safer default while it's being stocked
      })
      if (!port?.id) return
      if (flair) {
        for (const [i, typeKey] of flair.merchants.entries()) {
          const t = MERCHANT_TYPES[typeKey]
          await addItem('merchants', {
            port_id: port.id, name: t.label, type: typeKey, blurb: '',
            price_mult: t.mult ?? 1, stock: seedStock(typeKey), sort_order: i + 1,
          })
        }
      }
      setVisitingPortId(port.id); setSelectedMerchantId(''); setCatFilter('All')
    } catch (e) { marketError(e) }
  }

  const deletePort = async () => {
    if (!currentPort) return
    if (!confirm(`Remove the port “${currentPort.name}”? Its merchants and local goods go with it.`)) return
    try { await removeItem('ports', currentPort.id); selectPort('') } catch (e) { marketError(e) }
  }

  const addMerchant = async () => {
    if (!visitingPortId) return
    const t = MERCHANT_TYPES[newMerchantType]
    try {
      const m = await addItem('merchants', {
        port_id: visitingPortId, name: t.label, type: newMerchantType, blurb: '',
        price_mult: t.mult ?? 1, stock: seedStock(newMerchantType), sort_order: merchantsHere.length + 1,
      })
      if (m?.id) selectMerchant(m.id)
    } catch (e) { marketError(e) }
  }

  const deleteMerchant = async (m) => {
    if (!confirm(`Remove ${m.name} from this port? Its local goods go with it.`)) return
    try { await removeItem('merchants', m.id); setSelectedMerchantId('') } catch (e) { marketError(e) }
  }

  const addLocalGood = () =>
    addItem('marketGoods', {
      name: 'New custom good', category: merchantCats[0] || 'Provisions', provision: null,
      servings: 1, cost: 1, port_id: visitingPortId || null, merchant_id: currentMerchant?.id || null,
      sort_order: marketGoods.length + 1,
    }).catch(marketError)
  const updateGood = (id, patch) => patchItem('marketGoods', id, patch)

  // Add/remove catalog items from the current merchant's stock list.
  const stockOf = (m) => (Array.isArray(m?.stock) ? m.stock : [])
  const addToStock = (idx) => {
    if (!currentMerchant) return
    const stock = stockOf(currentMerchant)
    if (stock.includes(idx)) return
    patchItem('merchants', currentMerchant.id, { stock: [...stock, idx] })
  }
  const removeFromStock = (idx) => {
    if (!currentMerchant) return
    patchItem('merchants', currentMerchant.id, { stock: stockOf(currentMerchant).filter((i) => i !== idx) })
  }

  // Catalog picker (add anything from the database), related categories first.
  const stockList = useMemo(() => {
    const q = stockSearch.trim().toLowerCase()
    const cats = merchantType?.categories || []
    return [...CATALOG]
      .filter((c) => !q || `${c.name} ${c.desc || ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const ar = cats.includes(a.category) ? 0 : 1
        const br = cats.includes(b.category) ? 0 : 1
        if (ar !== br) return ar - br
        return a.name.localeCompare(b.name)
      })
  }, [stockSearch, merchantType])
  const stockShown = stockList.slice(0, 60)

  const importLegacy = async () => {
    if (!legacyGoods.length) return
    if (!confirm(`Import ${legacyGoods.length} good(s) from the old market? A port (with a Provisioner) is made for each old port name.`)) return
    try {
      const portNames = [...new Set(legacyGoods.map((g) => g.port).filter(Boolean))]
      const nameToMerchant = {}
      for (const [i, name] of portNames.entries()) {
        const port = await addItem('ports', { name, flair: null, blurb: '', price_mult: 1, sort_order: ports.length + i + 1 })
        const m = await addItem('merchants', { port_id: port.id, name: 'Provisioner', type: 'provisioner', blurb: '', price_mult: 1, sort_order: 1 })
        nameToMerchant[name] = m.id
      }
      for (const [i, g] of legacyGoods.entries()) {
        await addItem('marketGoods', {
          name: g.name || 'Good',
          category: g.provision ? 'Provisions' : 'Local',
          provision: g.provision || null,
          servings: Math.max(1, Number(g.servings) || 1),
          cost: Number(g.cost) || 0,
          port_id: null,
          merchant_id: g.port ? nameToMerchant[g.port] || null : null,
          sort_order: marketGoods.length + i + 1,
        })
      }
      await setSetting('market_items', null)
      alert('Old market imported. Retune ports, merchants, and prices as you like.')
    } catch (e) { marketError(e) }
  }

  const buyGood = async (g) => {
    const qty = Math.max(1, Number(buyQty[g.key]) || 1)
    const unit = gp(Math.max(0, g.base) * totalMult)
    const cost = gp(unit * qty)
    const where = `${currentMerchant ? ` from ${currentMerchant.name}` : ''}${currentPort ? ` at ${currentPort.name}` : ''}`
    const costCopper = Math.round(cost * 100)
    if (costCopper > purseCopper) {
      alert(`Not enough coin. That costs ${priceStr(cost)}, but the purse holds only ${coinStr(purse)}.`)
      return
    }
    if (!confirm(`Buy ${qty} × ${g.name} for ${priceStr(cost)}${where}? It lands in the Ship’s Stores, records a market expense in the ledger, and is paid from the purse.`))
      return
    const provision = g.provision || null
    const servings = provision ? Math.max(1, Number(g.servings) || 1) : 1
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
        name: g.name, container: 'ship', quantity: qty, provision, servings,
        sort_order: inventory.length + 1,
      })
    await addItem('ledger', {
      description: `Market — ${g.name}${qty > 1 ? ` ×${qty}` : ''}${where}`,
      amount: -cost,
      category: 'Market',
    })
    const spent = spendCoins(purse, costCopper)
    await patchSingleton('funds', { gold: spent.gold, silver: spent.silver, copper: spent.copper })
  }

  // A custom good belongs to one merchant. Moving it re-homes it to another
  // merchant at this port; "" unassigns it (hidden until reassigned).
  const soldByValue = (g) => g.merchant_id || ''
  const setSoldBy = (g, value) =>
    updateGood(g.id, { merchant_id: value || null, port_id: value ? visitingPortId : g.port_id })

  const renderGood = (g) => {
    const kind = KINDS[g.provision]
    const qty = Math.max(1, Number(buyQty[g.key]) || 1)
    const unit = gp(g.base * totalMult)
    const perServing = g.provision ? gp(unit / Math.max(1, g.servings)) : null
    return (
      <div className="card" key={g.key}>
        <div className="row-between">
          <strong className="grow">
            {kind ? kind.emoji + ' ' : ''}
            {g.homebrew && isDM
              ? <Editable value={g.name} onCommit={(v) => updateGood(g.id, { name: v })} />
              : g.name}
            <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>· {g.category}{g.homebrew && isDM ? ' · custom' : ''}</span>
          </strong>
          <span className="flex gap-sm" style={{ alignItems: 'center' }}>
            <Price gp={unit} />
            {totalMult !== 1 && <span className="muted" style={{ fontSize: 13 }}>(×{gp(totalMult)})</span>}
          </span>
        </div>

        {(g.desc || g.detail) && (
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {g.detail ? <em>{g.detail}. </em> : ''}{g.desc}
          </div>
        )}

        {g.homebrew && isDM && (
          <div className="flex gap-sm" style={{ alignItems: 'center', margin: '6px 0', flexWrap: 'wrap' }}>
            <select
              className="select" style={{ width: 'auto' }}
              value={g.provision || ''}
              onChange={(e) => updateGood(g.id, { provision: e.target.value || null })}
            >
              <option value="">🎒 Equipment</option>
              <option value="food">🍖 Food</option>
              <option value="drink">🍷 Drink</option>
            </select>
            {kind && (
              <span className="muted flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                <Editable type="number" value={g.servings} onCommit={(v) => updateGood(g.id, { servings: v })} /> {kind.each}
              </span>
            )}
            <span className="muted flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
              cost <Editable type="number" value={g.base} onCommit={(v) => updateGood(g.id, { cost: v })} /> gp
            </span>
            <span className="muted flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
              sold by
              <select className="select" style={{ width: 'auto' }} value={soldByValue(g)} onChange={(e) => setSoldBy(g, e.target.value)}>
                {merchantsHere.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="">— unassigned —</option>
              </select>
            </span>
            <button className="btn small danger" onClick={() => removeItem('marketGoods', g.id)}>remove</button>
          </div>
        )}

        {kind && !(g.homebrew && isDM) && (
          <div className="muted flex gap-sm" style={{ fontSize: 13, marginTop: 2, alignItems: 'center' }}>
            {g.servings} {kind.unit} each · <Price gp={perServing} />/{kind.unit === 'cups' ? 'cup' : 'ration'}
          </div>
        )}

        <div className="flex gap-sm" style={{ alignItems: 'center', marginTop: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>qty</span>
          <input
            className="input" type="number" min="1" style={{ width: 70 }}
            value={buyQty[g.key] ?? 1}
            onChange={(e) => setBuyQty((m) => ({ ...m, [g.key]: e.target.value }))}
          />
          <button className="btn brass small flex gap-sm" style={{ alignItems: 'center' }} onClick={() => buyGood(g)}>
            Buy for <Price gp={unit * qty} />
          </button>
          {isDM && !g.homebrew && (
            <button className="btn small danger ghost" onClick={() => removeFromStock(g.catalogIndex)}>remove</button>
          )}
        </div>
      </div>
    )
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
                  {canManageInventory && <button className="btn small ghost" onClick={() => addTo(c.id)}>+ item</button>}
                </div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{c.hint} · {items.length} items</div>
                <Droppable id={c.id} data={{ container: c.id }} className="dropzone">
                  <div className="list">
                    {items.length === 0 && <span className="role-empty">— empty —</span>}
                    {items.map((it) => {
                      const kind = KINDS[it.provision]
                      return (
                      <Draggable key={it.id} id={it.id} data={{ container: it.container }} disabled={!canManageInventory}>
                        <div className="card">
                          <div className="row-between">
                            <strong className="grow">
                              {kind ? kind.emoji + ' ' : ''}
                              <Editable value={it.name} editable={canManageInventory} onCommit={(v) => patchItem('inventory', it.id, { name: v })} />
                            </strong>
                            <span className="muted flex gap-sm" style={{ alignItems: 'center' }}>
                              ×<Editable type="number" value={it.quantity} editable={canManageInventory} onCommit={(v) => patchItem('inventory', it.id, { quantity: v })} />
                              {canManageInventory && <button className="btn small danger" onClick={() => removeItem('inventory', it.id)}>✕</button>}
                            </span>
                          </div>

                          {canManageInventory && (
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
                                  <Editable type="number" value={it.servings ?? 1} editable={canManageInventory} onCommit={(v) => patchItem('inventory', it.id, { servings: v })} />
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
                            <Editable value={it.description} placeholder="describe it…" editable={canManageInventory} onCommit={(v) => patchItem('inventory', it.id, { description: v })} />
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
        <div>
            {/* DM setup mode is automatic for anyone logged in with the dm/admin role. */}
            <div className="row-between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <span className="muted" style={{ fontSize: 13 }}>
                {isDM
                  ? '🔑 DM setup mode — you can create ports & merchants and set prices.'
                  : 'Shopping as crew. Ports, merchants, and prices are set by the DM.'}
              </span>
            </div>

            {/* Port bar */}
            <div className="row-between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <span className="flex gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="eyebrow">Now visiting</span>
                <select className="select" style={{ width: 'auto' }} value={visitingPortId} onChange={(e) => selectPort(e.target.value)}>
                  <option value="">— choose a port —</option>
                  {visiblePorts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(PORT_FLAIRS[p.flair]?.emoji || '🏝')} {p.name}{isDM && p.locked ? ' 🔒' : ''}
                    </option>
                  ))}
                </select>
              </span>
              <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 13 }}>Purse</span>
                <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                  <span className="coin tiny gold" title="gold">{Number(purse.gold) || 0}</span>
                  <span className="coin tiny silver" title="silver">{Number(purse.silver) || 0}</span>
                  <span className="coin tiny copper" title="copper">{Number(purse.copper) || 0}</span>
                </span>
              </span>
            </div>

            {/* DM: create ports */}
            {isDM && (
              <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
                <span className="eyebrow">Make port:</span>
                <button className="btn small brass" onClick={() => createPort(null)}>+ Blank</button>
                {PORT_FLAIR_KEYS.map((k) => (
                  <button key={k} className="btn small ghost" onClick={() => createPort(k)}>+ {PORT_FLAIRS[k].emoji} {PORT_FLAIRS[k].label}</button>
                ))}
                {legacyGoods.length > 0 && (
                  <button className="btn small ghost" onClick={importLegacy}>⤵ Import old market ({legacyGoods.length})</button>
                )}
              </div>
            )}

            {!currentPort ? (
              <div className="card">
                <span className="muted">
                  {visiblePorts.length === 0
                    ? isDM ? 'No ports yet — make one above to open its markets.' : 'No ports have been established yet.'
                    : 'Choose a port above to browse its merchants.'}
                </span>
              </div>
            ) : portLocked ? (
              <div className="card">
                <p style={{ margin: 0 }}>
                  <strong>{portFlair?.emoji || '🏝'} {currentPort.name}</strong> is locked — ask the DM to unlock it.
                </p>
              </div>
            ) : (
              <>
                {/* Port card */}
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div className="grow">
                      {isDM ? (
                        <div className="flex gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 18 }}>
                            {portFlair?.emoji || '🏝'} <Editable value={currentPort.name} onCommit={(v) => patchItem('ports', currentPort.id, { name: v })} />
                          </strong>
                          <span className="muted flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                            all prices ×<Editable type="number" value={currentPort.price_mult ?? 1} onCommit={(v) => patchItem('ports', currentPort.id, { price_mult: v })} />
                          </span>
                          <button
                            className={`btn small ${currentPort.locked ? 'brass' : 'ghost'}`}
                            onClick={() => patchItem('ports', currentPort.id, { locked: !currentPort.locked })}
                          >
                            {currentPort.locked ? '🔒 Locked — unlock for crew' : '🔓 Unlocked — lock from crew'}
                          </button>
                        </div>
                      ) : (
                        <strong style={{ fontSize: 18 }}>{portFlair?.emoji || '🏝'} {currentPort.name}</strong>
                      )}
                      <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                        {isDM
                          ? <Editable value={currentPort.blurb} placeholder="a line of flavor about this port…" onCommit={(v) => patchItem('ports', currentPort.id, { blurb: v })} />
                          : currentPort.blurb}
                      </div>
                    </div>
                    {isDM && <button className="btn small danger ghost" onClick={deletePort}>remove port</button>}
                  </div>
                </div>

                {/* DM: custom goods not attached to any merchant — assign or remove */}
                {isDM && unassignedGoods.length > 0 && merchantsHere.length > 0 && (
                  <div className="card" style={{ marginBottom: 12, borderColor: 'var(--wax-red)' }}>
                    <div className="eyebrow">Unassigned custom goods</div>
                    <p className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>
                      These aren’t attached to a merchant, so no one can buy them. Assign each to a merchant at this port, or remove it.
                    </p>
                    <div className="list">
                      {unassignedGoods.map((g) => (
                        <div className="card row-between" key={g.id}>
                          <strong className="grow">{g.name}</strong>
                          <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                            <select
                              className="select" style={{ width: 'auto' }} defaultValue=""
                              onChange={(e) => e.target.value && updateGood(g.id, { merchant_id: e.target.value, port_id: visitingPortId })}
                            >
                              <option value="">assign to…</option>
                              {merchantsHere.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            <button className="btn small danger" onClick={() => removeItem('marketGoods', g.id)}>remove</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Merchant tabs */}
                <div className="flex gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                  {merchantsHere.map((m) => {
                    const t = MERCHANT_TYPES[m.type]
                    const active = currentMerchant?.id === m.id
                    return (
                      <button key={m.id} className={`btn small ${active ? 'brass' : 'ghost'}`} onClick={() => selectMerchant(m.id)}>
                        {t?.emoji || '🧑‍💼'} {m.name}
                      </button>
                    )
                  })}
                  {isDM && (
                    <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                      <select className="select" style={{ width: 'auto' }} value={newMerchantType} onChange={(e) => setNewMerchantType(e.target.value)}>
                        {MERCHANT_TYPE_KEYS.map((k) => <option key={k} value={k}>{MERCHANT_TYPES[k].emoji} {MERCHANT_TYPES[k].label}</option>)}
                      </select>
                      <button className="btn small brass" onClick={addMerchant}>+ Merchant</button>
                    </span>
                  )}
                </div>

                {merchantsHere.length === 0 ? (
                  <div className="card"><span className="muted">No merchants here yet{isDM ? ' — add one above.' : '.'}</span></div>
                ) : currentMerchant && (
                  <>
                    {/* Merchant header / editor */}
                    <div className="row-between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <span className="flex gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="eyebrow">{merchantType?.emoji} {merchantType?.label || currentMerchant.type}</span>
                        {isDM && (
                          <>
                            <Editable value={currentMerchant.name} onCommit={(v) => patchItem('merchants', currentMerchant.id, { name: v })} />
                            <select
                              className="select" style={{ width: 'auto' }}
                              value={currentMerchant.type}
                              onChange={(e) => patchItem('merchants', currentMerchant.id, { type: e.target.value })}
                            >
                              {MERCHANT_TYPE_KEYS.map((k) => <option key={k} value={k}>{MERCHANT_TYPES[k].emoji} {MERCHANT_TYPES[k].label}</option>)}
                            </select>
                            <span className="muted flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                              markup ×<Editable type="number" value={currentMerchant.price_mult ?? 1} onCommit={(v) => patchItem('merchants', currentMerchant.id, { price_mult: v })} />
                            </span>
                            <button className="btn small danger ghost" onClick={() => deleteMerchant(currentMerchant)}>remove</button>
                          </>
                        )}
                      </span>
                      <span className="muted" style={{ fontSize: 13 }}>prices ×{gp(totalMult)} here</span>
                    </div>

                    {/* Search + category chips */}
                    <div className="flex gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                      <input className="input" style={{ maxWidth: 260 }} placeholder="Search wares…" value={search} onChange={(e) => setSearch(e.target.value)} />
                      {catChips.length > 2 && (
                        <span className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                          {catChips.map((c) => (
                            <button key={c} className={`btn small ${catFilter === c ? 'brass' : 'ghost'}`} onClick={() => setCatFilter(c)}>{c}</button>
                          ))}
                        </span>
                      )}
                      {isDM && <button className="btn small brass" onClick={() => { setStockSearch(''); setStockOpen(true) }}>+ Add items</button>}
                      {isDM && <button className="btn small ghost" onClick={addLocalGood}>+ Custom good</button>}
                    </div>

                    {/* Wares */}
                    <div className="list">
                      {shown.length === 0 && <div className="card"><span className="muted">Nothing for sale here matches. Try another search or filter.</span></div>}
                      {shown.map(renderGood)}
                    </div>
                    {filtered.length > DISPLAY_CAP && (
                      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                        Showing {DISPLAY_CAP} of {filtered.length} — narrow it with search or a category filter.
                      </p>
                    )}
                  </>
                )}
              </>
            )}

            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              Purchases land in the Ship’s Stores, record a ledger expense, and are paid from the purse. Prices are the 5e
              catalog base × the port’s multiplier × the merchant’s markup.
              {isDM && ' Tune those multipliers or add local goods to shape the economy.'}
            </p>
          </div>
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

      {stockOpen && currentMerchant && (
        <Modal onClose={() => setStockOpen(false)}>
          <h2 className="section-title">Stock {currentMerchant.name}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Add anything from the 5e catalog — {merchantType?.label || 'this merchant'}’s related goods are listed first. Click to add or remove.
          </p>
          <input
            className="input" autoFocus placeholder="Search the catalog…"
            value={stockSearch} onChange={(e) => setStockSearch(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div className="list" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
            {stockShown.map((c) => {
              const inStock = stockOf(currentMerchant).includes(c.index)
              const kind = KINDS[c.provision]
              return (
                <div className="card row-between" key={c.index}>
                  <div className="grow">
                    <strong>{kind ? kind.emoji + ' ' : ''}{c.name}</strong>
                    <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>· {c.category}</span>
                    <div className="muted flex gap-sm" style={{ fontSize: 13, marginTop: 2, alignItems: 'center' }}>
                      <Price gp={c.cost_gp} />{c.detail ? ` · ${c.detail}` : ''}
                    </div>
                  </div>
                  {inStock
                    ? <button className="btn small danger ghost" onClick={() => removeFromStock(c.index)}>✓ remove</button>
                    : <button className="btn small brass" onClick={() => addToStock(c.index)}>+ add</button>}
                </div>
              )
            })}
          </div>
          {stockList.length > stockShown.length && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Showing {stockShown.length} of {stockList.length} — refine your search.
            </p>
          )}
          <div className="toolbar" style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={() => setStockOpen(false)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
