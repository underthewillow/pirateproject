import { useData } from '../../context/DataContext'
import Avatar from './Avatar'
import Editable from './Editable'
import Modal from './Modal'

const LOCATIONS = [
  { value: 'ship', label: 'On the Ship' },
  { value: 'shore', label: 'Ashore' },
  { value: 'available', label: 'Available (reserve)' },
]

// Full character sheet. Stats are a flexible key/value map so you can add
// whatever your table cares about (STR, morale, bounty…) without a migration.
export default function CharacterModal({ member, onClose }) {
  const { patchItem, removeItem, roles, canEdit } = useData()
  if (!member) return null

  const stats = member.stats && typeof member.stats === 'object' ? member.stats : {}
  const setStats = (next) => patchItem('crew', member.id, { stats: next })

  const addStat = () => {
    const name = prompt('Stat name (e.g. STR, Morale, Bounty)')
    if (name) setStats({ ...stats, [name]: '' })
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex gap" style={{ alignItems: 'center' }}>
        <Avatar member={member} size="lg" />
        <div className="grow">
          <Editable
            as="h2"
            className="section-title"
            value={member.name}
            onCommit={(v) => patchItem('crew', member.id, { name: v })}
          />
          <Editable
            as="div"
            className="eyebrow"
            placeholder="add a title / epithet"
            value={member.title}
            onCommit={(v) => patchItem('crew', member.id, { title: v })}
          />
        </div>
      </div>

      <hr className="rule" />

      <div className="panel-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label className="eyebrow">Whereabouts</label>
          {canEdit ? (
            <select
              className="select"
              value={member.location}
              onChange={(e) => patchItem('crew', member.id, { location: e.target.value })}
            >
              {LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          ) : (
            <div>{LOCATIONS.find((l) => l.value === member.location)?.label}</div>
          )}
        </div>
        <div>
          <label className="eyebrow">Role aboard</label>
          {canEdit ? (
            <select
              className="select"
              value={member.role || ''}
              onChange={(e) => patchItem('crew', member.id, { role: e.target.value || null })}
            >
              <option value="">— none —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          ) : (
            <div>{member.role || <span className="muted">none</span>}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="eyebrow">Log entry / bio</label>
        <Editable
          as="p"
          multiline
          placeholder="Write what's known of this soul…"
          value={member.bio}
          onCommit={(v) => patchItem('crew', member.id, { bio: v })}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="row-between">
          <label className="eyebrow">Stats</label>
          {canEdit && <button className="btn small ghost" onClick={addStat}>+ stat</button>}
        </div>
        <div className="list" style={{ marginTop: 8 }}>
          {Object.keys(stats).length === 0 && <span className="muted">No stats recorded.</span>}
          {Object.entries(stats).map(([k, v]) => (
            <div className="row-between card" key={k}>
              <strong>{k}</strong>
              <span className="flex gap-sm" style={{ alignItems: 'center' }}>
                <Editable
                  value={v}
                  onCommit={(nv) => setStats({ ...stats, [k]: nv })}
                  placeholder="—"
                />
                {canEdit && (
                  <button
                    className="btn small danger"
                    onClick={() => {
                      const next = { ...stats }; delete next[k]; setStats(next)
                    }}
                  >✕</button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {canEdit && (
        <>
          <hr className="rule" />
          <div className="panel-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="eyebrow">Portrait image URL</label>
              <Editable
                value={member.image_url}
                placeholder="paste an image link"
                onCommit={(v) => patchItem('crew', member.id, { image_url: v })}
              />
            </div>
            <div>
              <label className="eyebrow">Token colour</label>
              <input
                type="color"
                value={member.color || '#6b4a2b'}
                onChange={(e) => patchItem('crew', member.id, { color: e.target.value })}
                style={{ width: 60, height: 34, background: 'none', border: 'none' }}
              />
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: 18, justifyContent: 'space-between' }}>
            <button
              className="btn danger"
              onClick={() => { if (confirm(`Remove ${member.name} from the roster?`)) { removeItem('crew', member.id); onClose() } }}
            >Remove from roster</button>
            <button className="btn brass" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
  )
}
