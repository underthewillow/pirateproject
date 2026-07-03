import { useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import Editable from '../common/Editable'
import Modal from '../common/Modal'

const TYPE_COLORS = {
  port: '#3a7a4a', island: '#8a6a2f', hazard: '#8a2f2b', treasure: '#b08d3f', city: '#4a5a8a',
}

export default function MapTab() {
  const { locations, addItem, patchItem, removeItem, canEdit } = useData()
  const [openId, setOpenId] = useState(null)
  const [localPos, setLocalPos] = useState(null) // {id,x,y} during drag
  const stageRef = useRef(null)
  const dragRef = useRef(null)

  const coords = (e) => {
    const rect = stageRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }

  const onStageClick = (e) => {
    if (!canEdit || e.target !== stageRef.current) return
    const { x, y } = coords(e)
    const name = prompt('Name this place')
    if (name) addItem('locations', { name, x, y, discovered: true, type: 'island' })
  }

  const startDrag = (e, loc) => {
    if (!canEdit) return
    e.stopPropagation()
    dragRef.current = { id: loc.id, moved: false, sx: e.clientX, sy: e.clientY }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const onMove = (e) => {
    const d = dragRef.current
    if (!d) return
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true
    if (d.moved) setLocalPos({ id: d.id, ...coords(e) })
  }
  const onUp = (e) => {
    const d = dragRef.current
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    dragRef.current = null
    setLocalPos(null)
    if (!d) return
    if (d.moved) patchItem('locations', d.id, coords(e))
    else setOpenId(d.id)
  }

  const openLoc = locations.find((l) => l.id === openId)

  return (
    <div>
      <div className="row-between">
        <div>
          <h2 className="section-title">Charted Waters</h2>
          <p className="muted" style={{ margin: 0 }}>
            {canEdit ? 'Click open water to drop a marker · drag markers to move · click a marker to open it.' : 'Click a marker to read its notes.'}
          </p>
        </div>
      </div>

      <div className="map-stage" ref={stageRef} onClick={onStageClick} style={{ marginTop: 12 }}>
        {locations.map((l) => {
          const pos = localPos && localPos.id === l.id ? localPos : l
          return (
            <div
              key={l.id}
              className={`map-pin ${l.discovered ? '' : 'undiscovered'}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onPointerDown={(e) => startDrag(e, l)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dot" style={{ background: l.discovered ? (TYPE_COLORS[l.type] || '#8a6a2f') : undefined }} />
              <div className="label">{l.discovered ? l.name : '???'}</div>
            </div>
          )
        })}
      </div>

      <div className="flex wrap gap-sm" style={{ marginTop: 12 }}>
        {Object.entries(TYPE_COLORS).map(([t, c]) => (
          <span key={t} className="badge" style={{ borderColor: c }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: c, borderRadius: 3, marginRight: 5 }} />{t}
          </span>
        ))}
      </div>

      {openLoc && (
        <Modal onClose={() => setOpenId(null)}>
          <h2 className="section-title">
            <Editable value={openLoc.name} onCommit={(v) => patchItem('locations', openLoc.id, { name: v })} />
          </h2>
          <div className="toolbar" style={{ marginTop: 6 }}>
            {canEdit ? (
              <select className="select" style={{ width: 160 }} value={openLoc.type || 'island'} onChange={(e) => patchItem('locations', openLoc.id, { type: e.target.value })}>
                {Object.keys(TYPE_COLORS).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : <span className="badge">{openLoc.type}</span>}
            <label className="flex gap-sm" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={!!openLoc.discovered} disabled={!canEdit} onChange={(e) => patchItem('locations', openLoc.id, { discovered: e.target.checked })} />
              Discovered
            </label>
          </div>
          <hr className="rule" />
          <Editable as="p" multiline placeholder="What's known of this place…" value={openLoc.description} onCommit={(v) => patchItem('locations', openLoc.id, { description: v })} />
          {canEdit && (
            <div className="toolbar" style={{ marginTop: 16, justifyContent: 'space-between' }}>
              <button className="btn danger" onClick={() => { removeItem('locations', openLoc.id); setOpenId(null) }}>Remove marker</button>
              <button className="btn brass" onClick={() => setOpenId(null)}>Close</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
