import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAppAuth } from '../../context/AuthContext'
import { assetUrl } from '../../lib/asset'
import { uploadImage } from '../../lib/upload'
import Editable from '../common/Editable'
import Lightbox from '../common/Lightbox'

// Scuttlebutt (issues #31 / #22 / #21): the crew's shared board plus a private
// scratch pad.
//   - Board posts carry text and/or an image. A post is either public to the
//     whole party (target_crew_id = null) or private to one player character
//     (target_crew_id set) — only the DM and whoever plays that PC see it. The
//     DM uses this to show everyone (or one player) new NPCs, items, locations,
//     etc. Any crew member can post public notes; only the DM can target a post
//     privately.
//   - The scratch pad (app_users.scratch_pad) is each user's own private notes.
function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function BulletinTab() {
  const { bulletinNotes, appUsers, crew, addItem, patchItem, removeItem, canEdit, isDM } = useData()
  const { identity, hasRole } = useAppAuth()
  const [lightbox, setLightbox] = useState(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [uploadErr, setUploadErr] = useState('')

  // Any crew member can post/edit their own; the DM can manage anyone's.
  const canContribute = canEdit || hasRole('crew_member')
  const me = appUsers.find((u) => u.id === identity?.id)
  const canManage = (n) => canEdit || (!!identity?.id && n.user_id === identity.id)

  const pcs = crew.filter((c) => c.is_pc) // private posts target a player character
  const crewById = Object.fromEntries(crew.map((c) => [c.id, c]))
  const myCharIds = new Set(identity?.linkedCrewIds || [])

  // A private post is visible only to the DM and whoever plays the target PC.
  const visibleNotes = bulletinNotes.filter((n) => !n.target_crew_id || isDM || myCharIds.has(n.target_crew_id))

  const addNote = () =>
    addItem('bulletinNotes', {
      body: '',
      image_url: null,
      target_crew_id: null,
      author: identity?.displayName || 'A hand',
      user_id: identity?.id ?? null,
      sort_order: bulletinNotes.length + 1,
    })

  const saveScratch = (v) => { if (identity?.id) patchItem('appUsers', identity.id, { scratch_pad: v }) }

  const onPickImage = async (n, file) => {
    if (!file) return
    setUploadErr('')
    setUploadingId(n.id)
    try {
      const url = await uploadImage(file)
      await patchItem('bulletinNotes', n.id, { image_url: url })
    } catch (e) {
      console.error('image upload failed', e)
      setUploadErr('Image upload failed — the storage bucket may not be set up yet (migration 0005).')
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div>
      {/* ---- Shared board ---- */}
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 2 }}>Scuttlebutt</h2>
          <p className="map-tagline">Notes, announcements, and shared sightings — post to the whole crew, or (DM) to one hand alone.</p>
        </div>
        {canContribute && <button className="btn small brass" onClick={addNote}>+ Post</button>}
      </div>

      {uploadErr && <p className="muted" style={{ color: 'var(--wax-red)', margin: '4px 0 0' }}>{uploadErr}</p>}

      <div className="corkboard">
        <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 22 }}>
          {visibleNotes.length === 0 && (
            <p className="muted">Nothing posted yet. {canContribute ? 'Pin the first note.' : ''}</p>
          )}
          {visibleNotes.map((n) => {
            const target = n.target_crew_id ? crewById[n.target_crew_id] : null
            const img = n.image_url ? assetUrl(n.image_url) : ''
            return (
              <div key={n.id} className={`parchment note ${n.target_crew_id ? 'note-private' : ''}`}
                style={{ transform: `rotate(${((n.sort_order || 0) % 3) - 1}deg)` }}>
                <div className="pin-tack" />
                {n.target_crew_id && (
                  <div className="note-private-badge">🔒 Private → {target?.name || 'a hand'}</div>
                )}
                {img && (
                  <img className="note-img" src={img} alt="" loading="lazy"
                    onClick={() => setLightbox(img)} title="Click to enlarge" />
                )}
                <Editable as="div" className="note-body" multiline
                  editable={canManage(n)}
                  placeholder="Write a note…"
                  value={n.body}
                  onCommit={(v) => patchItem('bulletinNotes', n.id, { body: v })} />
                {canManage(n) && (
                  <div className="note-controls">
                    <div className="note-imgbtns">
                      <label className={`btn small ghost note-upload ${uploadingId === n.id ? 'disabled' : ''}`}>
                        {uploadingId === n.id ? 'Uploading…' : (n.image_url ? '📷 Replace image' : '📷 Add image')}
                        <input type="file" accept="image/*" hidden disabled={uploadingId === n.id}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onPickImage(n, f) }} />
                      </label>
                      {n.image_url && (
                        <button className="btn small ghost" onClick={() => patchItem('bulletinNotes', n.id, { image_url: null })}>Remove image</button>
                      )}
                    </div>
                    {isDM && (
                      <select className="select note-target" value={n.target_crew_id || ''}
                        onChange={(e) => patchItem('bulletinNotes', n.id, { target_crew_id: e.target.value || null })}>
                        <option value="">Everyone (public)</option>
                        {pcs.map((c) => <option key={c.id} value={c.id}>Private → {c.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
                <div className="note-foot">
                  <span className="note-author">— {n.author || 'A hand'}{n.created_at ? `, ${formatDate(n.created_at)}` : ''}</span>
                  {canManage(n) && (
                    <button className="btn small danger" onClick={() => removeItem('bulletinNotes', n.id)}>Remove</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

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

      {lightbox && <Lightbox src={lightbox} alt="Shared image" onClose={() => setLightbox(null)} />}
    </div>
  )
}
