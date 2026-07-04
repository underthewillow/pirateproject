import { useCallback, useEffect, useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import { assetUrl } from '../../lib/asset'
import Editable from '../common/Editable'
import Modal from '../common/Modal'

// ---- chart image space (pixels of public/map.jpg) ----
const W = 1448
const H = 1086
const MAP_SRC = assetUrl('map.jpg')

// Place types: colour + a little chart glyph.
const TYPES = {
  port: { c: '#3a7a4a', g: '⚓', label: 'Port / Harbour' },
  city: { c: '#41568c', g: '❖', label: 'City' },
  landmark: { c: '#8a6a2f', g: '✦', label: 'Landmark' },
  hazard: { c: '#8a2f2b', g: '☠', label: 'Hazard' },
  cave: { c: '#5a4a6a', g: '☾', label: 'Cave' },
  treasure: { c: '#b08d3f', g: '✕', label: 'Treasure' },
  island: { c: '#6f6136', g: '⛰', label: 'Isle' },
}

// Regions — tuned to the painted chart. Used to fog uncharted ground and to
// tag newly-dropped markers. Fog is drawn over any region NOT yet charted.
const REGIONS = [
  { key: 'stormwreck', label: 'Stormwreck Isle', cx: 610, cy: 470, rx: 350, ry: 315 },
  { key: 'neverwinter', label: 'The Sword Coast', cx: 1255, cy: 470, rx: 265, ry: 520 },
  { key: 'saltmarsh', label: 'Saltmarsh', cx: 150, cy: 225, rx: 240, ry: 235 },
]

const regionAt = (x, y) => {
  for (const r of REGIONS) if (((x - r.cx) / r.rx) ** 2 + ((y - r.cy) / r.ry) ** 2 <= 1) return r.key
  return ''
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const clampView = (v) => {
  const s = clamp(v.s, 1, 6)
  return { s, tx: clamp(v.tx, W * (1 - s), 0), ty: clamp(v.ty, H * (1 - s), 0) }
}

export default function MapTab() {
  const { locations, settings, addItem, patchItem, removeItem, setSetting, canEdit } = useData()
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 })
  const [openId, setOpenId] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [localPos, setLocalPos] = useState(null) // {id,x,y} while dragging a marker

  const svgRef = useRef(null)
  const viewRef = useRef(view)
  viewRef.current = view
  const pointers = useRef(new Map())
  const pinchRef = useRef(null)
  const tapRef = useRef(null)
  const markerDrag = useRef(null)

  const charted = Array.isArray(settings?.charted_regions) ? settings.charted_regions : []
  const isCharted = (r) => !r || charted.includes(r)

  // ---- screen <-> map coordinate helpers ----
  const svgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = clientX; pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const p = pt.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }, [])

  const worldFromClient = useCallback((cx, cy) => {
    const vb = svgPoint(cx, cy)
    const v = viewRef.current
    return { x: (vb.x - v.tx) / v.s, y: (vb.y - v.ty) / v.s }
  }, [svgPoint])

  const zoomAround = useCallback((cx, cy, f) => {
    const vb = svgPoint(cx, cy)
    setView((v) => {
      const ns = clamp(v.s * f, 1, 6)
      const wx = (vb.x - v.tx) / v.s
      const wy = (vb.y - v.ty) / v.s
      return clampView({ s: ns, tx: vb.x - wx * ns, ty: vb.y - wy * ns })
    })
  }, [svgPoint])

  const pan = useCallback((dx, dy) => {
    setView((v) => clampView({ ...v, tx: v.tx + dx, ty: v.ty + dy }))
  }, [])

  // wheel zoom (attached manually so we can preventDefault)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e) => {
      e.preventDefault()
      zoomAround(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [zoomAround])

  // ---- background pan / pinch ----
  const onBgDown = (e) => {
    svgRef.current?.setPointerCapture?.(e.pointerId)
    if (pointers.current.size === 0) tapRef.current = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pinchRef.current = null
  }
  const onBgMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    const prev = pointers.current.get(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    if (pts.length >= 2) {
      const [a, b] = pts
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (pinchRef.current) zoomAround(mid.x, mid.y, dist / pinchRef.current)
      pinchRef.current = dist
      tapRef.current = null
    } else {
      const A = svgPoint(prev.x, prev.y), B = svgPoint(e.clientX, e.clientY)
      pan(B.x - A.x, B.y - A.y)
    }
  }
  const onBgUp = (e) => {
    svgRef.current?.releasePointerCapture?.(e.pointerId)
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current = null
    if (pointers.current.size > 0) return
    const start = tapRef.current
    tapRef.current = null
    const tapped = start && Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 6
    if (tapped && placing && canEdit) addMarkerAt(e.clientX, e.clientY)
  }

  const addMarkerAt = async (cx, cy) => {
    const w = worldFromClient(cx, cy)
    if (w.x < 0 || w.x > W || w.y < 0 || w.y > H) { setPlacing(false); return }
    const name = prompt('Name this place')
    if (!name) { setPlacing(false); return }
    await addItem('locations', {
      name, x: Math.round(w.x), y: Math.round(w.y),
      discovered: true, type: 'landmark', region: regionAt(w.x, w.y),
    })
    setPlacing(false)
  }

  // ---- marker drag / open ----
  const onMarkerDown = (e, loc) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    markerDrag.current = { id: loc.id, moved: false, sx: e.clientX, sy: e.clientY }
  }
  const onMarkerMove = (e) => {
    const d = markerDrag.current
    if (!d) return
    e.stopPropagation()
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) d.moved = true
    if (d.moved && canEdit) {
      const w = worldFromClient(e.clientX, e.clientY)
      setLocalPos({ id: d.id, x: clamp(w.x, 0, W), y: clamp(w.y, 0, H) })
    }
  }
  const onMarkerUp = (e, loc) => {
    const d = markerDrag.current
    e.stopPropagation()
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    markerDrag.current = null
    setLocalPos(null)
    if (!d) return
    if (d.moved && canEdit) {
      const w = worldFromClient(e.clientX, e.clientY)
      patchItem('locations', loc.id, { x: Math.round(clamp(w.x, 0, W)), y: Math.round(clamp(w.y, 0, H)) })
    } else if (loc.discovered) {
      setOpenId(loc.id)
    }
  }

  const zoomCenter = (f) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (r) zoomAround(r.left + r.width / 2, r.top + r.height / 2, f)
  }
  const toggleCharted = (key) => {
    const set = new Set(charted)
    set.has(key) ? set.delete(key) : set.add(key)
    setSetting('charted_regions', [...set])
  }

  const visible = locations.filter((l) => isCharted(l.region))
  const uncharted = REGIONS.filter((r) => !charted.includes(r.key))
  const openLoc = locations.find((l) => l.id === openId)
  const inv = 1 / view.s

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="section-title">The Chart</h2>
          <p className="muted" style={{ margin: 0 }}>
            Drag to sail the chart · scroll or pinch to zoom · tap a charted landfall to read its notes.
          </p>
        </div>
      </div>

      <div className="map-wrap" style={{ marginTop: 12 }}>
        <svg
          ref={svgRef}
          className="map-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ cursor: placing ? 'crosshair' : 'grab', touchAction: 'none' }}
          onPointerDown={onBgDown}
          onPointerMove={onBgMove}
          onPointerUp={onBgUp}
          onPointerCancel={onBgUp}
        >
          <defs>
            <filter id="soft"><feGaussianBlur stdDeviation="30" /></filter>
            <filter id="fognoise">
              <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="7" result="n" />
              <feColorMatrix in="n" type="matrix"
                values="0 0 0 0 0.13  0 0 0 0 0.18  0 0 0 0 0.2  0 0 0 0.6 0" />
            </filter>
            <clipPath id="mapclip"><rect x="0" y="0" width={W} height={H} /></clipPath>
          </defs>

          <g transform={`translate(${view.tx},${view.ty}) scale(${view.s})`} clipPath="url(#mapclip)">
            {/* painted chart */}
            <image href={MAP_SRC} xlinkHref={MAP_SRC} x="0" y="0" width={W} height={H} preserveAspectRatio="none" />

            {/* fog of war — one cloud over each region not yet charted */}
            {uncharted.map((r) => (
              <g key={r.key} pointerEvents="none">
                <ellipse cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} fill="#202c33" opacity="0.9" filter="url(#soft)" />
                <ellipse cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} filter="url(#fognoise)" opacity="0.55"
                  clipPath="url(#mapclip)" />
                <text x={r.cx} y={r.cy} textAnchor="middle"
                  style={{ font: 'italic 600 26px var(--font-display, serif)', fill: '#d8c8a6' }} opacity="0.5">
                  uncharted
                </text>
              </g>
            ))}

            {/* markers — aligned to the painted labels; the map already names them,
                so these are subtle clickable seals rather than big pins */}
            {visible.map((l) => {
              const p = localPos && localPos.id === l.id ? localPos : l
              const t = TYPES[l.type] || TYPES.landmark
              const known = !!l.discovered
              return (
                <g key={l.id}
                  className="map-marker"
                  transform={`translate(${Number(p.x)},${Number(p.y)}) scale(${inv})`}
                  style={{ cursor: canEdit ? 'grab' : 'pointer' }}
                  onPointerDown={(e) => onMarkerDown(e, l)}
                  onPointerMove={onMarkerMove}
                  onPointerUp={(e) => onMarkerUp(e, l)}
                  onPointerCancel={(e) => onMarkerUp(e, l)}
                >
                  <circle r="26" fill="transparent" />
                  <circle className="mm-pulse" r="15" fill="none" stroke={known ? t.c : '#6b573a'} strokeWidth="2" />
                  <circle className="mm-ring" r="13" fill={known ? t.c : '#6b573a'} fillOpacity="0.22"
                    stroke={known ? t.c : '#6b573a'} strokeWidth="2.5" />
                  <text className="mm-glyph" x="0" y="5" textAnchor="middle"
                    style={{ font: '15px serif', fill: known ? t.c : '#6b573a' }}>{known ? t.g : '?'}</text>
                  <g className="mm-label" transform="translate(0,-24)">
                    <text x="0" y="0" textAnchor="middle"
                      style={{ font: '600 16px var(--font-ui, sans-serif)', paintOrder: 'stroke', stroke: '#f7ecd2', strokeWidth: 5, strokeLinejoin: 'round', fill: '#2a1a0c' }}>
                      {known ? l.name : '???'}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>
        </svg>

        {/* HUD: zoom + tools */}
        <div className="map-hud map-hud-tl">
          <button className="map-btn" title="Zoom in" onClick={() => zoomCenter(1.35)}>＋</button>
          <button className="map-btn" title="Zoom out" onClick={() => zoomCenter(1 / 1.35)}>－</button>
          <button className="map-btn" title="Reset view" onClick={() => setView({ s: 1, tx: 0, ty: 0 })}>⤢</button>
          {canEdit && (
            <button className={`map-btn wide ${placing ? 'active' : ''}`} onClick={() => setPlacing((p) => !p)}>
              {placing ? '✕ cancel' : '＋ marker'}
            </button>
          )}
        </div>

        {placing && <div className="map-hint">Tap the chart to drop a marker</div>}

        {canEdit && (
          <div className="map-hud map-hud-tr map-regions">
            <div className="eyebrow" style={{ marginBottom: 4 }}>Charted regions</div>
            {REGIONS.map((r) => (
              <label key={r.key} className="flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={charted.includes(r.key)} onChange={() => toggleCharted(r.key)} />
                {r.label}
              </label>
            ))}
          </div>
        )}

        {/* legend */}
        <div className="map-hud map-hud-bl map-legend">
          {Object.entries(TYPES).map(([k, t]) => (
            <span key={k} className="map-leg-item"><span className="map-leg-dot" style={{ background: t.c }} />{t.label}</span>
          ))}
        </div>
      </div>

      {openLoc && (
        <Modal onClose={() => setOpenId(null)}>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            <Editable value={openLoc.name} onCommit={(v) => patchItem('locations', openLoc.id, { name: v })} />
          </h2>
          <div className="toolbar" style={{ marginTop: 6, flexWrap: 'wrap' }}>
            {canEdit ? (
              <select className="select" style={{ width: 170 }} value={openLoc.type || 'landmark'}
                onChange={(e) => patchItem('locations', openLoc.id, { type: e.target.value })}>
                {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
            ) : (
              <span className="badge">{(TYPES[openLoc.type] || TYPES.landmark).label}</span>
            )}
            {canEdit ? (
              <select className="select" style={{ width: 170 }} value={openLoc.region || ''}
                onChange={(e) => patchItem('locations', openLoc.id, { region: e.target.value })}>
                <option value="">Open sea</option>
                {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            ) : (
              <span className="badge">{REGIONS.find((r) => r.key === openLoc.region)?.label || 'Open sea'}</span>
            )}
            <label className="flex gap-sm" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={!!openLoc.discovered} disabled={!canEdit}
                onChange={(e) => patchItem('locations', openLoc.id, { discovered: e.target.checked })} />
              Discovered
            </label>
          </div>
          <hr className="rule" />
          <Editable as="p" multiline placeholder="What's known of this place…"
            value={openLoc.description} onCommit={(v) => patchItem('locations', openLoc.id, { description: v })} />
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
