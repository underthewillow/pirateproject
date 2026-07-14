import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react'
import { supabase } from '../lib/supabase'
import { fetchAll, insertRow, updateRow, deleteRow, upsertRow } from '../lib/api'

const DataContext = createContext(null)
export const useData = () => useContext(DataContext)

// Collections (arrays) vs singletons (single row) vs the key/value settings table.
const COLLECTIONS = {
  roles: 'roles',
  crew: 'crew_members',
  inventory: 'inventory_items',
  ledger: 'ledger_entries',
  locations: 'map_locations',
  quests: 'quests',
  journal: 'journal_entries',
  ports: 'ports',
  merchants: 'merchants',
  marketGoods: 'market_goods',
  appUsers: 'app_users',
  rolls: 'roll_log',
  bulletinNotes: 'bulletin_notes',
}
const SINGLETONS = { ship: 'ship', funds: 'funds' }
const ALL_TABLES = [
  ...Object.values(COLLECTIONS),
  ...Object.values(SINGLETONS),
  'settings',
]
// table name -> state key (for realtime routing)
const TABLE_TO_KEY = Object.fromEntries([
  ...Object.entries(COLLECTIONS).map(([k, t]) => [t, k]),
  ...Object.entries(SINGLETONS).map(([k, t]) => [t, k]),
])

export function DataProvider({ children }) {
  const [data, setData] = useState({
    ship: null,
    funds: null,
    roles: [],
    crew: [],
    inventory: [],
    ledger: [],
    locations: [],
    quests: [],
    journal: [],
    ports: [],
    merchants: [],
    marketGoods: [],
    appUsers: [],
    rolls: [],
    bulletinNotes: [],
    settings: {},
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [canEdit, setCanEdit] = useState(false)
  const [isDM, setIsDM] = useState(false)
  const dataRef = useRef(data)
  dataRef.current = data

  // ---- initial load ----
  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [
        ship,
        funds,
        roles,
        crew,
        inventory,
        ledger,
        locations,
        quests,
        journal,
        ports,
        merchants,
        marketGoods,
        appUsers,
        rolls,
        bulletinNotes,
        settingsRows,
      ] = await Promise.all([
        fetchAll('ship').then((r) => r[0] ?? null),
        fetchAll('funds').then((r) => r[0] ?? null),
        fetchAll('roles'),
        fetchAll('crew_members'),
        fetchAll('inventory_items'),
        fetchAll('ledger_entries', 'created_at'),
        fetchAll('map_locations', 'created_at'),
        fetchAll('quests'),
        fetchAll('journal_entries'),
        // Market tables may not exist yet (they need a one-time SQL migration);
        // degrade to empty lists instead of failing the whole app load.
        fetchAll('ports').catch(() => []),
        fetchAll('merchants').catch(() => []),
        fetchAll('market_goods').catch(() => []),
        // app_users needs its own one-time SQL migration too (supabase/schema/app_users.sql).
        fetchAll('app_users', 'created_at').catch(() => []),
        // roll_log needs migration 0002_roll_log.sql; degrade gracefully if absent.
        fetchAll('roll_log', 'created_at').catch(() => []),
        // bulletin_notes needs migration 0003_bulletin_board.sql; degrade gracefully.
        fetchAll('bulletin_notes').catch(() => []),
        fetchAll('settings', 'key'),
      ])
      const settings = {}
      for (const row of settingsRows) settings[row.key] = row.value
      setData({ ship, funds, roles, crew, inventory, ledger, locations, quests, journal, ports, merchants, marketGoods, appUsers, rolls, bulletinNotes, settings })
      setError(null)
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ---- realtime sync ----
  useEffect(() => {
    const channel = supabase.channel('campaign-changes')
    ALL_TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) =>
        applyRealtime(table, payload)
      )
    })
    channel.subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyRealtime(table, payload) {
    const { eventType, new: newRow, old: oldRow } = payload
    if (table === 'settings') {
      setData((d) => {
        const settings = { ...d.settings }
        if (eventType === 'DELETE') delete settings[oldRow.key]
        else settings[newRow.key] = newRow.value
        return { ...d, settings }
      })
      return
    }
    const key = TABLE_TO_KEY[table]
    if (!key) return
    if (SINGLETONS[key]) {
      setData((d) => ({ ...d, [key]: eventType === 'DELETE' ? null : newRow }))
      return
    }
    // collection
    setData((d) => {
      const list = d[key] || []
      let next
      if (eventType === 'INSERT') {
        next = list.some((r) => r.id === newRow.id) ? list : [...list, newRow]
      } else if (eventType === 'UPDATE') {
        next = list.map((r) => (r.id === newRow.id ? newRow : r))
      } else {
        next = list.filter((r) => r.id !== oldRow.id)
      }
      return { ...d, [key]: sortList(key, next) }
    })
  }

  function sortList(key, list) {
    if (key === 'ledger' || key === 'locations' || key === 'appUsers' || key === 'rolls') {
      return [...list].sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
    }
    return [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }

  // ---- mutation helpers (optimistic, then persisted) ----
  const addItem = useCallback(async (key, values) => {
    const table = COLLECTIONS[key]
    const row = await insertRow(table, values)
    setData((d) =>
      d[key].some((r) => r.id === row.id)
        ? d
        : { ...d, [key]: sortList(key, [...d[key], row]) }
    )
    return row
  }, [])

  const patchItem = useCallback(async (key, id, patch) => {
    const table = COLLECTIONS[key]
    setData((d) => ({
      ...d,
      [key]: sortList(
        key,
        d[key].map((r) => (r.id === id ? { ...r, ...patch } : r))
      ),
    }))
    try {
      await updateRow(table, id, patch)
    } catch (e) {
      console.error('patch failed', e)
      load()
    }
  }, [load])

  const removeItem = useCallback(async (key, id) => {
    const table = COLLECTIONS[key]
    const prev = dataRef.current[key]
    setData((d) => ({ ...d, [key]: d[key].filter((r) => r.id !== id) }))
    try {
      await deleteRow(table, id)
    } catch (e) {
      console.error('delete failed', e)
      setData((d) => ({ ...d, [key]: prev }))
    }
  }, [])

  // Multiple roles per crew member (roles is a text[] column).
  const addRole = useCallback((memberId, roleName) => {
    const m = dataRef.current.crew.find((c) => c.id === memberId)
    if (!m) return
    const current = Array.isArray(m.roles) ? m.roles : []
    if (current.includes(roleName)) return
    return patchItem('crew', memberId, { roles: [...current, roleName] })
  }, [patchItem])

  const removeRole = useCallback((memberId, roleName) => {
    const m = dataRef.current.crew.find((c) => c.id === memberId)
    if (!m) return
    const current = Array.isArray(m.roles) ? m.roles : []
    return patchItem('crew', memberId, { roles: current.filter((r) => r !== roleName) })
  }, [patchItem])

  // Multiple RBAC roles per app user (app_users.roles is a text[] column, same
  // convention as crew_members.roles).
  const addUserRole = useCallback((userId, role) => {
    const u = dataRef.current.appUsers.find((r) => r.id === userId)
    if (!u) return
    const current = Array.isArray(u.roles) ? u.roles : []
    if (current.includes(role)) return
    return patchItem('appUsers', userId, { roles: [...current, role] })
  }, [patchItem])

  const removeUserRole = useCallback((userId, role) => {
    const u = dataRef.current.appUsers.find((r) => r.id === userId)
    if (!u) return
    const current = Array.isArray(u.roles) ? u.roles : []
    return patchItem('appUsers', userId, { roles: current.filter((r) => r !== role) })
  }, [patchItem])

  const setLinkedCrewIds = useCallback((userId, crewIds) => {
    return patchItem('appUsers', userId, { linked_crew_ids: crewIds })
  }, [patchItem])

  // Create-or-update the app_users row for whoever just logged in (OIDC sub,
  // or the reserved 'local-admin' breakglass id). Brand-new users get no
  // roles at all (read-only "birthright" access) — an admin grants
  // crew_member/dm/admin/etc. from Settings > User Management.
  const upsertAppUser = useCallback(async (id, fields) => {
    const existing = dataRef.current.appUsers.find((u) => u.id === id)
    const row = await upsertRow('app_users', {
      id,
      roles: existing?.roles ?? [],
      linked_crew_ids: existing?.linked_crew_ids ?? [],
      ...fields,
      last_login_at: new Date().toISOString(),
    })
    setData((d) => ({
      ...d,
      appUsers: d.appUsers.some((u) => u.id === row.id)
        ? d.appUsers.map((u) => (u.id === row.id ? row : u))
        : sortList('appUsers', [...d.appUsers, row]),
    }))
    return row
  }, [])

  const patchSingleton = useCallback(async (key, patch) => {
    const table = SINGLETONS[key]
    setData((d) => ({ ...d, [key]: { ...d[key], ...patch } }))
    try {
      await updateRow(table, 1, patch)
    } catch (e) {
      console.error('singleton patch failed', e)
      load()
    }
  }, [load])

  const setSetting = useCallback(async (key, value) => {
    setData((d) => ({ ...d, settings: { ...d.settings, [key]: value } }))
    await upsertRow('settings', { key, value }, 'key')
  }, [])

  // canEdit / isDM are now driven by AuthContext (derived from the logged-in
  // user's roles) via these setters, rather than by a standalone passphrase.

  // DM-staged characters: any crew member flagged stats.hidden is concealed
  // from everyone but the DM/admin. This lets the DM create an NPC ahead of
  // time and reveal them to the crew on their own timing. Mutations still act
  // on data.crew by id, and internal callbacks read dataRef.current.crew, so
  // only the *exposed* list is filtered.
  const visibleCrew = useMemo(
    () => (isDM ? data.crew : data.crew.filter((c) => !c?.stats?.hidden)),
    [data.crew, isDM]
  )

  const value = useMemo(
    () => ({
      ...data,
      crew: visibleCrew,
      loading,
      error,
      canEdit,
      setCanEdit,
      isDM,
      setIsDM,
      reload: load,
      addItem,
      patchItem,
      removeItem,
      addRole,
      removeRole,
      addUserRole,
      removeUserRole,
      setLinkedCrewIds,
      upsertAppUser,
      patchSingleton,
      setSetting,
    }),
    [data, visibleCrew, loading, error, canEdit, isDM, load, addItem, patchItem, removeItem, addRole, removeRole, addUserRole, removeUserRole, setLinkedCrewIds, upsertAppUser, patchSingleton, setSetting]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
