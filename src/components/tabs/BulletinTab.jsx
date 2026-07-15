import { useEffect, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAppAuth } from '../../context/AuthContext'
import { assetUrl } from '../../lib/asset'
import { uploadImage } from '../../lib/upload'
import Editable from '../common/Editable'
import ImageInput from '../common/ImageInput'
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

// Posts per scrapbook leaf before it turns — fewer on phones so a leaf isn't a
// giant single-column scroll (and the page-turn shows up with fewer posts).
const PER_PAGE_DESKTOP = 6
const PER_PAGE_MOBILE = 3

export default function BulletinTab() {
  const { bulletinNotes, appUsers, crew, addItem, patchItem, removeItem, canEdit, isDM } = useData()
  const { identity, hasRole } = useAppAuth()
  const [lightbox, setLightbox] = useState(null)
  const [pasteBusy, setPasteBusy] = useState(false)
  const [editingId, setEditingId] = useState(null) // note whose edit controls are shown
  const [page, setPage] = useState(0) // current scrapbook leaf
  const [perPage, setPerPage] = useState(PER_PAGE_DESKTOP)

  // Fewer posts per leaf on narrow screens (matches the 640px CSS breakpoint).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setPerPage(mq.matches ? PER_PAGE_MOBILE : PER_PAGE_DESKTOP)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Any crew member can post/edit their own; the DM can manage anyone's.
  const canContribute = canEdit || hasRole('crew_member')
  const me = appUsers.find((u) => u.id === identity?.id)
  const canManage = (n) => canEdit || (!!identity?.id && n.user_id === identity.id)
  const canReorder = canContribute // anyone who can post can arrange the scrapbook

  const pcs = crew.filter((c) => c.is_pc) // private posts target a player character
  const crewById = Object.fromEntries(crew.map((c) => [c.id, c]))
  const myCharIds = new Set(identity?.linkedCrewIds || [])

  // A private post is visible only to the DM and whoever plays the target PC.
  const visibleNotes = bulletinNotes.filter((n) => !n.target_crew_id || isDM || myCharIds.has(n.target_crew_id))

  // Paginate the visible posts into scrapbook leaves.
  const pageCount = Math.max(1, Math.ceil(visibleNotes.length / perPage))
  const safePage = Math.min(page, pageCount - 1)
  const pageNotes = visibleNotes.slice(safePage * perPage, safePage * perPage + perPage)

  const addNote = async () => {
    setPage(Math.floor(visibleNotes.length / perPage)) // land on the new post's leaf
    const row = await addItem('bulletinNotes', {
      body: '',
      image_url: null,
      target_crew_id: null,
      author: identity?.displayName || 'A hand',
      user_id: identity?.id ?? null,
      sort_order: bulletinNotes.length + 1,
    })
    if (row?.id) setEditingId(row.id) // open a fresh post ready to edit
  }

  // Move a post one slot earlier/later (dir = -1 / +1), hopping across leaves so
  // it can be placed anywhere. Operates on the *visible* order (what this viewer
  // sees) and swaps the two posts' sort_order values — so it's correct even for
  // a non-DM who can't see interleaved private posts, and never clobbers them.
  const reorder = (note, dir) => {
    const i = visibleNotes.findIndex((x) => x.id === note.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= visibleNotes.length) return
    const a = visibleNotes[i], b = visibleNotes[j]
    const ao = a.sort_order ?? 0, bo = b.sort_order ?? 0
    // Swap positions by swapping sort_order values. If they happen to tie, nudge
    // so a lands on the correct side of b.
    patchItem('bulletinNotes', a.id, { sort_order: ao === bo ? bo + dir : bo })
    patchItem('bulletinNotes', b.id, { sort_order: ao })
    setPage(Math.floor(j / perPage)) // follow the post to its new leaf
  }

  const saveScratch = (v) => { if (identity?.id) patchItem('appUsers', identity.id, { scratch_pad: v }) }

  // Paste an image (⌘/Ctrl+V) anywhere on the tab to share it as a new post —
  // handy for screenshots or images copied off the web, no file to save first.
  // Only reacts to image clipboard data, so pasting text into a note is normal.
  useEffect(() => {
    if (!canContribute) return
    const onPaste = async (e) => {
      const item = [...(e.clipboardData?.items || [])].find((it) => it.type?.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      e.preventDefault()
      setPasteBusy(true)
      try {
        setPage(Math.floor(visibleNotes.length / perPage)) // land on the new post's leaf
        const url = await uploadImage(file, 'scuttlebutt')
        await addItem('bulletinNotes', {
          body: '', image_url: url, target_crew_id: null,
          author: identity?.displayName || 'A hand', user_id: identity?.id ?? null,
          sort_order: (bulletinNotes.length || 0) + 1,
        })
      } catch (err) {
        console.error('pasted image upload failed', err)
      } finally {
        setPasteBusy(false)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [canContribute, addItem, identity, bulletinNotes.length, perPage])

  return (
    <div>
      {/* ---- Shared board ---- */}
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 2 }}>Scuttlebutt</h2>
          <p className="map-tagline">
            The crew's scrapbook — notes, announcements, and shared sightings, leaf by leaf. Post to the whole crew, or (DM) to one hand alone.
            {canContribute && ' Paste an image (⌘/Ctrl+V) to share it.'}
          </p>
        </div>
        {canContribute && (
          <button className="btn small brass" onClick={addNote} disabled={pasteBusy}>
            {pasteBusy ? 'Posting image…' : '+ Post'}
          </button>
        )}
      </div>

      <div className="scrapbook">
        <div className="scrap-page" key={safePage}>
          <div className="scrap-grid">
            {visibleNotes.length === 0 && (
              <p className="muted">The scrapbook is empty. {canContribute ? 'Paste in the first clipping.' : ''}</p>
            )}
            {pageNotes.map((n, localIdx) => {
              const target = n.target_crew_id ? crewById[n.target_crew_id] : null
              const img = n.image_url ? assetUrl(n.image_url) : ''
              const vi = safePage * perPage + localIdx // slot in the visible order
              return (
                <div key={n.id} className={`parchment note ${n.target_crew_id ? 'note-private' : ''}`}
                  style={{ transform: `rotate(${((n.sort_order || 0) % 3) - 1}deg)` }}>
                  <div className="pin-tack" />
                  {canReorder && (
                    <div className="scrap-move">
                      <button className="scrap-move-btn" title="Move earlier"
                        disabled={vi <= 0} onClick={() => reorder(n, -1)}>‹</button>
                      <button className="scrap-move-btn" title="Move later"
                        disabled={vi >= visibleNotes.length - 1} onClick={() => reorder(n, 1)}>›</button>
                    </div>
                  )}
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
                  {canManage(n) && editingId === n.id && (
                    <div className="note-controls">
                      <ImageInput value={n.image_url} folder="scuttlebutt" showPreview={false}
                        onCommit={(v) => patchItem('bulletinNotes', n.id, { image_url: v })} />
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
                      editingId === n.id ? (
                        <span className="flex gap-sm">
                          <button className="btn small ghost" onClick={() => setEditingId(null)}>Done</button>
                          <button className="btn small danger" onClick={() => { removeItem('bulletinNotes', n.id); setEditingId((id) => (id === n.id ? null : id)) }}>Remove</button>
                        </span>
                      ) : (
                        <button className="btn small ghost" onClick={() => setEditingId(n.id)}>✎ Edit</button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {pageCount > 1 && (
          <div className="scrap-nav">
            <button className="btn small" onClick={() => setPage(safePage - 1)} disabled={safePage <= 0}>‹ Prev</button>
            <span className="hb-dots">
              {Array.from({ length: pageCount }, (_, i) => (
                <span key={i} className={`hb-dot ${i === safePage ? 'on' : ''}`} onClick={() => setPage(i)} />
              ))}
            </span>
            <button className="btn small" onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount - 1}>Next ›</button>
            <span className="scrap-count">Leaf {safePage + 1} of {pageCount}</span>
          </div>
        )}
      </div>

      {/* ---- Private scratch pad (everyone, self-editable) ---- */}
      {identity && (
        <>
          <h3 className="section-title small" style={{ marginTop: 30 }}>Your Scratch Pad</h3>
          <hr className="rule" />
          <p className="muted" style={{ margin: '0 0 10px' }}>Private to you — jottings, reminders, plans. Only you see this in the app.</p>
          <div className="card scratchpad">
            <Editable as="div" className="scratchpad-body" multiline
              editable enterNewline
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
