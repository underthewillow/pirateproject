import { useData } from '../../context/DataContext'
import { useAppAuth } from '../../context/AuthContext'
import Editable from '../common/Editable'

// The ship's cork board (issues #31 / #22):
//   1. a shared board of notes/announcements anyone in the crew can pin;
//   2. a private scratch pad, visible only to the logged-in user; and
//   3. "sealed orders" — the DM writes a private note to a CHARACTER
//      (crew_members.dm_note); whoever is logged in and linked to that
//      character (app_users.linked_crew_ids) reads it. This is the private
//      DM->player channel that covers #22: personal items live on D&D Beyond,
//      so the DM just needs a way to hand things out / whisper to one player.
function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function BulletinTab() {
  const { bulletinNotes, appUsers, crew, addItem, patchItem, removeItem, canEdit, isDM } = useData()
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

  // Sealed orders attach to a character. Reverse-map character id -> the
  // player(s) linked to it, so the DM can see who will read each dispatch.
  const playersByChar = {}
  for (const u of appUsers) for (const cid of u.linked_crew_ids || []) (playersByChar[cid] ||= []).push(u.display_name || u.id)

  // The character(s) the logged-in user plays — they read those characters'
  // sealed orders (read-only).
  const myChars = crew.filter((c) => identity?.linkedCrewIds?.includes(c.id))
  const myOrders = myChars.filter((c) => c.dm_note && c.dm_note.trim())

  // DM writes to any character that's linked to a player.
  const dispatchChars = isDM
    ? crew.filter((c) => (playersByChar[c.id] || []).length > 0).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
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

      {/* ---- Sealed orders from the DM (read-only, for the character you play) ---- */}
      {identity && myOrders.length > 0 && (
        <>
          <h3 className="section-title small" style={{ marginTop: 30 }}>Sealed Orders</h3>
          <hr className="rule" />
          <p className="muted" style={{ margin: '0 0 10px' }}>A private word from the DM — for your eyes only.</p>
          {myOrders.map((c) => (
            <div className="card sealed" key={c.id} style={{ marginBottom: 10 }}>
              {myChars.length > 1 && <div className="eyebrow" style={{ marginBottom: 4 }}>{c.name}</div>}
              <div className="sealed-body">{c.dm_note}</div>
            </div>
          ))}
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

      {/* ---- DM: private dispatch to each character (secret notes / item grants) ---- */}
      {isDM && (
        <>
          <h3 className="section-title small" style={{ marginTop: 30 }}>Sealed Orders — Private Dispatches</h3>
          <hr className="rule" />
          <p className="muted" style={{ margin: '0 0 10px' }}>
            Write privately to a character — a secret message, or an item they receive out of sight of the rest of the crew.
            Only whoever's logged in as that character can see it.
          </p>
          {dispatchChars.length === 0 ? (
            <p className="muted">
              No characters are linked to a player yet. Assign characters to users in Settings › User Management,
              then you can send them sealed orders here.
            </p>
          ) : (
            <div className="dispatch-list">
              {dispatchChars.map((c) => (
                <div className="card dispatch" key={c.id}>
                  <div className="dispatch-head">
                    <span className="dispatch-name">{c.name}</span>
                    <span className="dispatch-roles">played by {playersByChar[c.id].join(', ')}</span>
                  </div>
                  <Editable as="div" className="sealed-body" multiline
                    editable
                    placeholder="Send a private note or item…"
                    value={c.dm_note || ''}
                    onCommit={(v) => patchItem('crew', c.id, { dm_note: v })} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
