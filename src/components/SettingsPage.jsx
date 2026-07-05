import { useState, useEffect } from 'react'
import { useData } from '../context/DataContext'
import { useAppAuth } from '../context/AuthContext'
import { ALL_ROLES, ROLE_LABELS } from '../config/roles'

const SUB_TABS = [
  { key: 'general', label: 'General', roles: null },
  { key: 'auth', label: 'Authentication', roles: ['admin'] },
  { key: 'users', label: 'User Management', roles: ['admin'] },
  { key: 'dm', label: 'DM Settings', roles: ['admin', 'dm'] },
]

function AuthenticationTab() {
  const { settings, setSetting } = useData()
  return (
    <div>
      <h3 className="section-title">Authentication</h3>
      <p className="muted">OIDC connects login to your Authentik instance. The breakglass password lets the local admin in if OIDC is down or not set up yet.</p>

      <label className="eyebrow">OIDC issuer / authority URL</label>
      <input className="input" defaultValue={settings?.oidc_issuer_url ?? ''} placeholder="https://auth.example.com/application/o/pirate-log/"
        onBlur={(e) => setSetting('oidc_issuer_url', e.target.value)} />

      <label className="eyebrow" style={{ marginTop: 12, display: 'block' }}>OIDC client ID</label>
      <input className="input" defaultValue={settings?.oidc_client_id ?? ''} placeholder="public client id"
        onBlur={(e) => setSetting('oidc_client_id', e.target.value)} />

      <label className="eyebrow" style={{ marginTop: 12, display: 'block' }}>Login button label</label>
      <input className="input" defaultValue={settings?.oidc_button_label ?? ''} placeholder="Log in with SSO"
        onBlur={(e) => setSetting('oidc_button_label', e.target.value)} />

      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        Saved immediately, but the OIDC connection itself only picks up changes after a page refresh.
      </p>

      <hr className="rule" style={{ margin: '18px 0' }} />

      <label className="eyebrow">Breakglass password</label>
      <input className="input" type="text" defaultValue={settings?.local_admin_passphrase ?? ''} placeholder="set a password"
        onBlur={(e) => setSetting('local_admin_passphrase', e.target.value)} />
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        Logs in as the local <strong>admin</strong> user with full control. Leave blank to allow anyone in via this path (not recommended once OIDC works).
      </p>
    </div>
  )
}

function UserManagementTab() {
  const { appUsers, crew, addUserRole, removeUserRole, setLinkedCrewIds } = useData()
  const { identity } = useAppAuth()

  // Guardrails against locking everyone out of admin: the local breakglass
  // account can never be demoted, nobody can demote themselves, and the last
  // real (non-local-admin) admin can't be removed either — otherwise the
  // breakglass password would become the only way back in.
  const realAdminCount = appUsers.filter((u) => u.id !== 'local-admin' && (u.roles || []).includes('admin')).length
  const blockAdminRemoval = (u) => {
    if (u.id === 'local-admin') return "The local admin account can't be demoted."
    if (u.id === identity?.id) return "You can't remove your own admin role."
    if (realAdminCount <= 1) return 'At least one admin besides the local admin must remain.'
    return null
  }

  return (
    <div>
      <h3 className="section-title">User Management</h3>
      <p className="muted">Assign roles and link each logged-in user to their character.</p>

      {appUsers.length === 0 && <p className="muted">No one has logged in yet.</p>}

      <div className="list">
        {appUsers.map((u) => (
          <div className="card" key={u.id}>
            <div className="row-between">
              <strong>{u.display_name || u.email || u.id}</strong>
              <span className="muted" style={{ fontSize: 12 }}>{u.email}</span>
            </div>

            <div className="eyebrow" style={{ marginTop: 10 }}>Roles</div>
            <div className="flex wrap gap-sm" style={{ marginTop: 4 }}>
              {ALL_ROLES.map((role) => {
                const active = (u.roles || []).includes(role)
                const blockReason = role === 'admin' && active ? blockAdminRemoval(u) : null
                return (
                  <button
                    key={role}
                    className={`btn small ${active ? 'brass' : 'ghost'}`}
                    disabled={!!blockReason}
                    title={blockReason || undefined}
                    onClick={() => (active ? removeUserRole(u.id, role) : addUserRole(u.id, role))}
                  >
                    {ROLE_LABELS[role] || role}
                  </button>
                )
              })}
            </div>

            <div className="eyebrow" style={{ marginTop: 10 }}>Linked character(s)</div>
            <select
              className="select"
              multiple
              value={u.linked_crew_ids || []}
              onChange={(e) => setLinkedCrewIds(u.id, Array.from(e.target.selectedOptions, (o) => o.value))}
              style={{ marginTop: 4, minHeight: 80 }}
            >
              {crew.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.is_pc ? '' : ' (NPC)'}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

function GeneralTab() {
  const { logout, identity } = useAppAuth()
  const { patchItem } = useData()
  const [name, setName] = useState(identity?.displayName || '')

  useEffect(() => setName(identity?.displayName || ''), [identity?.displayName])

  const commit = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== identity?.displayName) {
      patchItem('appUsers', identity.id, { display_name: trimmed })
    } else {
      setName(identity?.displayName || '')
    }
  }

  return (
    <div>
      <h3 className="section-title">General</h3>

      <label className="eyebrow">Display name</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} />
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        Shown in the header and to admins in User Management — useful since names from SSO aren't always readable.
      </p>

      <button className="btn ghost" style={{ marginTop: 16 }} onClick={logout}>Log out</button>
    </div>
  )
}

function DMSettingsTab() {
  return (
    <div>
      <h3 className="section-title">DM Settings</h3>
      <p className="muted">Foundation for future campaign-unlock tools — nothing here yet.</p>
    </div>
  )
}

export default function SettingsPage({ onBack }) {
  const { hasRole } = useAppAuth()
  const visibleTabs = SUB_TABS.filter((t) => !t.roles || t.roles.some(hasRole))
  const [active, setActive] = useState(visibleTabs[0]?.key || 'general')

  const content = {
    general: <GeneralTab />,
    auth: <AuthenticationTab />,
    users: <UserManagementTab />,
    dm: <DMSettingsTab />,
  }[active]

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>⚙ Settings</h2>
        <button className="btn ghost" onClick={onBack}>← Back to the Helm</button>
      </div>

      <nav className="tabbar">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${active === t.key ? 'active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="parchment panel" style={{ marginTop: 16 }}>
        {content}
      </div>
    </div>
  )
}
