import { useData } from '../../context/DataContext'
import { useAppAuth } from '../../context/AuthContext'
import Editable from '../common/Editable'

// The ship's cork board (issues #31 / #22):
//   1. a shared board of notes/announcements anyone in the crew can pin;
//   2. a private scratch pad, visible only to the logged-in user; and
//   3. "sealed orders" — the DM writes a private dispatch to each hand (secret
//      messages, or items they receive unseen by the rest of the crew), which
//      that player reads read-only. This replaces the need for a private
//      inventory tab (#22): personal items live on D&D Beyond; the DM just
//      needs a private channel to hand things out.
function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function BulletinTab() {
  const { bulletinNotes, appUsers, addItem, patchItem, removeItem, canEdit, isDM } = useData()
  const { identity, hasRole } = useAppAuth()
  // Same contribution rule as the journal: any crew member can pin/edit their
  // own notes; the DM/admin can manage anyone's.
  const canContribute = canEdit || hasRole('crew_member')
  const me = appUsers.find((u) => u.id === identity?.id)
  const canManage = (n) => canEdit || (!!identity?.id && n.user_id === identity.id)

  const addNote = () =>
    addItem('bulletinNotes', {
      body: '',
      author: identity?.displayName || 'A hand',
      user_id: identity?.id ?? null,
      sort_order: bulletinNotes.length + 1,
    })

  const saveScratch = (v) => { if (identity?.id) patchItem('appUsers', identity.id, { scratch_pad: v }) }

  // DM writes a private dispatch to each other user (secret message / item grant).
  const dispatchUsers = isDM
    ? [...appUsers]
        .filter((u) => u.id !== identity?.id)
        .sort((a, b) => (a.display_name || a.id).localeCompare(b.display_name || b.id))
    : []

  return (
    <div>
      {/* ---- Shared cork board ---- */}
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 2 }}>The Cork Board</h2>
          <p className="map-tagline">Notes, announcements, and general scuttlebutt for the whole crew.</p>
        </div>
        {canContribute && <button className="btn small brass" onClick={addNote}>+ Pin a note</button>}
      </div>

      <div className="corkboard">
        <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 22 }}>
          {bulletinNotes.length === 0 && (
            <p className="muted">The board's bare. {canContribute ? 'Pin the first note.' : 'Nothing posted yet.'}</p>
          )}
          {bulletinNotes.map((n) => (
            <div key={n.id} className="parchment note" style={{ transform: `rotate(${((n.sort_order || 0) % 3) - 1}deg)` }}>
              <div className="pin-tack" />
              <Editable as="div" className="note-body" multiline
                editable={canManage(n)}
                placeholder="Write your note…"
                value={n.body}
                onCommit={(v) => patchItem('bulletinNotes', n.id, { body: v })} />
              <div className="note-foot">
                <span className="note-author">— {n.author || 'A hand'}{n.created_at ? `, ${formatDate(n.created_at)}` : ''}</span>
                {canManage(n) && (
                  <button className="btn small danger" onClick={() => removeItem('bulletinNotes', n.id)}>Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Sealed orders from the DM (player sees their own, read-only) ---- */}
      {identity && !isDM && me?.dm_note && (
        <>
          <h3 className="section-title small" style={{ marginTop: 30 }}>Sealed Orders</h3>
          <hr className="rule" />
          <p className="muted" style={{ margin: '0 0 10px' }}>A private word from the DM — for your eyes only.</p>
          <div className="card sealed">
            <div className="sealed-body">{me.dm_note}</div>
          </div>
        </>
      )}

      {/* ---- Private scratch pad (everyone, self-editable) ---- */}
      {identity && (
        <>
          <h3 className="section-title small" style={{ marginTop: 30 }}>Your Scratch Pad</h3>
          <hr className="rule" />
          <p className="muted" style={{ margin: '0 0 10px' }}>Private to you — jottings, reminders, plans. Only you see this in the app.</p>
          <div className="card scratchpad">
            <Editable as="div" className="scratchpad-body" multiline
              editable
              placeholder="Your private notes…"
              value={me?.scratch_pad || ''}
              onCommit={saveScratch} />
          </div>
        </>
      )}

      {/* ---- DM: private dispatches to each hand (secret notes / item grants) ---- */}
      {isDM && (
        <>
          <h3 className="section-title small" style={{ marginTop: 30 }}>Sealed Orders — Private Dispatches</h3>
          <hr className="rule" />
          <p className="muted" style={{ margin: '0 0 10px' }}>
            Write privately to a single hand — a secret message, or an item they receive out of sight of the rest of the crew.
            Only that person (and you) can see it.
          </p>
          {dispatchUsers.length === 0 ? (
            <p className="muted">No other crew have logged in yet.</p>
          ) : (
            <div className="dispatch-list">
              {dispatchUsers.map((u) => (
                <div className="card dispatch" key={u.id}>
                  <div className="dispatch-head">
                    <span className="dispatch-name">{u.display_name || u.id}</span>
                    {Array.isArray(u.roles) && u.roles.length > 0 && (
                      <span className="dispatch-roles">{u.roles.join(', ')}</span>
                    )}
                  </div>
                  <Editable as="div" className="sealed-body" multiline
                    editable
                    placeholder="Send a private note or item…"
                    value={u.dm_note || ''}
                    onCommit={(v) => patchItem('appUsers', u.id, { dm_note: v })} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
