import { useState } from 'react'
import { useData } from '../../context/DataContext'
import CrewToken from '../common/CrewToken'
import CharacterModal from '../common/CharacterModal'

export default function RolesTab() {
  const { roles, crew, addRole, removeRole, canEdit } = useData()
  const [openId, setOpenId] = useState(null)

  const rolesOf = (m) => (Array.isArray(m.roles) ? m.roles : [])
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '')
  const openMember = crew.find((c) => c.id === openId)

  return (
    <div>
      <h2 className="section-title">Crew Roles</h2>
      <p className="muted">
        Appoint a hand to any station from its dropdown — the same person can hold several posts.
        Use the ✕ on a token to relieve them of just that station.
      </p>

      <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: 12 }}>
        {roles.map((r) => {
          const holders = crew.filter((c) => rolesOf(c).includes(r.name))
          const available = crew.filter((c) => !rolesOf(c).includes(r.name)).sort(byName)
          return (
            <div key={r.id} className="role-slot">
              <div className="grow">
                <div className="role-name">{r.name}</div>
                <div className="role-desc">{r.description}</div>
                <div className="flex wrap gap-sm" style={{ marginTop: 8 }}>
                  {holders.length === 0 && <span className="role-empty">— vacant —</span>}
                  {holders.map((m) => (
                    <div key={m.id} className="flex gap-sm" style={{ alignItems: 'center' }}>
                      <CrewToken member={m} onOpen={() => setOpenId(m.id)} />
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
                {canEdit && (
                  <select
                    className="select role-appoint"
                    style={{ marginTop: 10 }}
                    value=""
                    onChange={(e) => { if (e.target.value) addRole(e.target.value, r.name) }}
                  >
                    <option value="">+ Appoint a hand…</option>
                    {available.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Roster overview — click a hand to open their sheet. */}
      <div style={{ marginTop: 22 }}>
        <div className="dropzone-label">Ship's Roster · {crew.length}</div>
        <div className="dropzone">
          <div className="flex wrap gap-sm">
            {crew.length === 0 && <span className="role-empty">No crew on record.</span>}
            {crew.map((m) => (
              <CrewToken key={m.id} member={m} onOpen={() => setOpenId(m.id)} showRole />
            ))}
          </div>
        </div>
      </div>

      {openMember && <CharacterModal member={openMember} onClose={() => setOpenId(null)} />}
    </div>
  )
}
