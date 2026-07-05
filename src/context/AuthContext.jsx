import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { AuthProvider as OidcProvider, useAuth as useOidc } from 'react-oidc-context'
import { useData } from './DataContext'

const AppAuthContext = createContext(null)
export const useAppAuth = () => useContext(AppAuthContext)

const LOCAL_ADMIN_FLAG = 'pcl_local_admin'

function toIdentity(row) {
  if (!row) return null
  return {
    id: row.id,
    displayName: row.display_name || row.email || row.id,
    roles: Array.isArray(row.roles) ? row.roles : [],
    linkedCrewIds: Array.isArray(row.linked_crew_ids) ? row.linked_crew_ids : [],
  }
}

// Inner provider — always mounted inside the OIDC provider, so it's safe to
// call useOidc() unconditionally here.
function InnerAuthProvider({ oidcConfigured, children }) {
  const { loading, appUsers, settings, upsertAppUser, setCanEdit, setIsDM } = useData()
  const oidc = useOidc()
  const [identity, setIdentity] = useState(null)
  // Becomes true once we've made a definitive first attempt to restore a
  // session (OIDC or breakglass) — until then, App.jsx shows a loading state
  // instead of flashing the login page for someone who's actually logged in.
  const [authReady, setAuthReady] = useState(false)
  const upsertedSub = useRef(null)

  // canEdit/isDM (consumed everywhere via useData()) are derived from roles
  // rather than a standalone passphrase — admin or dm can do both today.
  useEffect(() => {
    const elevated = !!identity?.roles?.some((r) => r === 'admin' || r === 'dm')
    setCanEdit(elevated)
    setIsDM(elevated)
  }, [identity, setCanEdit, setIsDM])

  // Bootstrap: on first load (or refresh), figure out whether there's an
  // existing OIDC session or a breakglass flag to restore, before deciding
  // whether to show the login page.
  useEffect(() => {
    if (loading) return // app_users/settings not loaded yet
    if (oidcConfigured && oidc.isLoading) return // oidc-client-ts still checking storage

    if (oidcConfigured && oidc.isAuthenticated && oidc.user) {
      const sub = oidc.user.profile?.sub
      if (sub && upsertedSub.current !== sub) {
        upsertedSub.current = sub
        // Roles aren't touched here — upsertAppUser defaults brand-new users
        // to ['crew_member'] and preserves whatever an admin has already
        // assigned for returning users. Role changes happen only through
        // Settings > User Management.
        upsertAppUser(sub, {
          email: oidc.user.profile?.email ?? null,
          display_name: oidc.user.profile?.name || oidc.user.profile?.preferred_username || null,
        })
          .then((row) => setIdentity(toIdentity(row)))
          .catch((e) => console.error('OIDC login failed', e))
          .finally(() => setAuthReady(true))
        return
      }
    }

    if (!identity && localStorage.getItem(LOCAL_ADMIN_FLAG) === '1') {
      const row = appUsers.find((u) => u.id === 'local-admin')
      if (row) setIdentity(toIdentity(row))
    }
    setAuthReady(true)
  }, [loading, oidcConfigured, oidc.isLoading, oidc.isAuthenticated, oidc.user, appUsers, identity, upsertAppUser])

  const loginBreakglass = useCallback(async (attempt) => {
    const pass = settings?.local_admin_passphrase
    if (pass != null && String(attempt) !== String(pass)) return false
    const existing = appUsers.find((u) => u.id === 'local-admin')
    const row = await upsertAppUser('local-admin', {
      display_name: 'admin',
      roles: existing?.roles ?? ['admin'],
    })
    localStorage.setItem(LOCAL_ADMIN_FLAG, '1')
    setIdentity(toIdentity(row))
    return true
  }, [settings, appUsers, upsertAppUser])

  const logout = useCallback(async () => {
    // Clear the OIDC session first and wait for it — if we reset
    // upsertedSub/identity while oidc.isAuthenticated is still (briefly)
    // true, the bootstrap effect sees what looks like a fresh login and
    // immediately logs the same user back in before removeUser() finishes.
    if (oidc.isAuthenticated) await oidc.removeUser()
    localStorage.removeItem(LOCAL_ADMIN_FLAG)
    upsertedSub.current = null
    setIdentity(null)
  }, [oidc])

  const hasRole = useCallback((role) => !!identity?.roles?.includes(role), [identity])

  const value = useMemo(() => ({
    identity,
    authReady,
    hasRole,
    loginBreakglass,
    logout,
    oidcConfigured,
    oidcButtonLabel: settings?.oidc_button_label || 'Log in with SSO',
    signinRedirect: oidcConfigured ? oidc.signinRedirect : null,
  }), [identity, authReady, hasRole, loginBreakglass, logout, oidcConfigured, settings, oidc])

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
}

// Outer wrapper — reads OIDC config from settings once at startup. Editing
// Authentication settings updates the DB immediately (no rebuild/redeploy
// needed) but only takes effect for the OIDC client after a page refresh —
// remounting this on every keystroke would blow away the whole app's UI
// state (and any in-progress login), which is worse than requiring a refresh.
export function AppAuthProvider({ children }) {
  const { settings, loading } = useData()

  if (loading) {
    return (
      <div className="app">
        <header className="masthead leather">
          <div>
            <h1 className="masthead-title">The Captain's Log</h1>
            <div className="masthead-sub">— A Pirate Chronicle —</div>
          </div>
        </header>
        <main className="panel"><div className="spinner">Unfurling the charts…</div></main>
      </div>
    )
  }

  const authority = settings?.oidc_issuer_url || ''
  const clientId = settings?.oidc_client_id || ''
  const oidcConfigured = !!authority && !!clientId
  const redirectUri = window.location.origin + import.meta.env.BASE_URL

  return (
    <OidcProvider
      authority={authority || 'https://unconfigured.invalid'}
      client_id={clientId || 'unconfigured'}
      redirect_uri={redirectUri}
      scope="openid profile email"
      automaticSilentRenew={oidcConfigured}
      onSigninCallback={() => {
        window.history.replaceState({}, document.title, window.location.pathname)
      }}
    >
      <InnerAuthProvider oidcConfigured={oidcConfigured}>{children}</InnerAuthProvider>
    </OidcProvider>
  )
}
