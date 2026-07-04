import { useCallback, useEffect, useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import Editable from '../common/Editable'
import Modal from '../common/Modal'

// ---- map constants ----
const W = 2000
const H = 1400

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

// Regions used for the fog-of-war reveal and for tagging new markers.
const REGIONS = [
  { key: 'stormwreck', label: 'Stormwreck Isle', cx: 955, cy: 745, rx: 400, ry: 360, lx: 955, ly: 1055 },
  { key: 'neverwinter', label: 'The Sword Coast', cx: 1880, cy: 660, rx: 300, ry: 600, lx: 1815, ly: 405 },
  { key: 'saltmarsh', label: 'Saltmarsh', cx: 300, cy: 335, rx: 320, ry: 300, lx: 300, ly: 500 },
]

// Smooth closed spline (Catmull-Rom -> cubic bezier) so coastlines read as
// hand-drawn rather than polygonal.
function smoothClosed(pts) {
  const n = pts.length
  let d = `M ${pts[0][0]} ${pts[0][1]} `
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]} `
  }
  return d + 'Z'
}

// Stormwreck Isle — centre of the chart, with a little cove notched into the
// north-west shoulder where Crackhaven Cove sits (~805,640).
const STORMWRECK = smoothClosed([
  [1000, 472], [1128, 508], [1236, 602], [1268, 732], [1206, 882],
  [1066, 978], [912, 1002], [786, 956], [688, 848], [652, 728],
  [720, 656], [792, 700], [822, 652], [788, 588], [864, 520], [936, 500],
])
// The Sword Coast — eastern mainland, coastline facing the isle.
const SWORD_COAST = smoothClosed([
  [2000, 300], [1748, 356], [1662, 512], [1706, 660], [1640, 820],
  [1724, 984], [2000, 1052],
])
// Saltmarsh — cluster of low islands to the north-west (still uncharted).
const SALTMARSH = smoothClosed([
  [300, 208], [384, 250], [412, 340], [352, 432], [250, 442], [188, 358], [216, 268],
])

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
  const openLoc = locations.find((l) => l.id === openId)
  const inv = 1 / view.s

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="section-title">The Chart</h2>
          <p className="muted" style={{ margin: 0 }}>
            {canEdit
              ? 'Drag to sail the chart · scroll or pinch to zoom · tap a landfall to read its notes.'
              : 'Drag to sail the chart · scroll or pinch to zoom · tap a charted landfall to read its notes.'}
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
            <radialGradient id="sea" cx="48%" cy="42%" r="75%">
              <stop offset="0%" stopColor="#5c8f92" />
              <stop offset="55%" stopColor="#3f7276" />
              <stop offset="100%" stopColor="#2b5457" />
            </radialGradient>
            <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d7c690" />
              <stop offset="100%" stopColor="#b49a5c" />
            </linearGradient>
            <filter id="soft"><feGaussianBlur stdDeviation="26" /></filter>
            <filter id="fognoise">
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="7" result="n" />
              <feColorMatrix in="n" type="matrix"
                values="0 0 0 0 0.12  0 0 0 0 0.17  0 0 0 0 0.19  0 0 0 0.55 0" />
            </filter>
            <mask id="fogmask">
              <rect x="0" y="0" width={W} height={H} fill="#fff" />
              {REGIONS.filter((r) => charted.includes(r.key)).map((r) => (
                <ellipse key={r.key} cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} fill="#000" filter="url(#soft)" />
              ))}
            </mask>
          </defs>

          <g transform={`translate(${view.tx},${view.ty}) scale(${view.s})`}>
            {/* sea */}
            <rect x="0" y="0" width={W} height={H} fill="url(#sea)" />

            {/* graticule */}
            <g stroke="#f3ecd4" strokeOpacity="0.10" strokeWidth="1">
              {Array.from({ length: 9 }, (_, i) => <line key={'v' + i} x1={(i + 1) * 200} y1="0" x2={(i + 1) * 200} y2={H} />)}
              {Array.from({ length: 6 }, (_, i) => <line key={'h' + i} x1="0" y1={(i + 1) * 200} x2={W} y2={(i + 1) * 200} />)}
            </g>

            {/* rhumb lines from a wind-rose point for chart flavour */}
            <g stroke="#e9dcb6" strokeOpacity="0.12" strokeWidth="1">
              {Array.from({ length: 16 }, (_, i) => {
                const a = (i * Math.PI) / 8
                return <line key={'r' + i} x1="955" y1="745" x2={955 + Math.cos(a) * 1600} y2={745 + Math.sin(a) * 1600} />
              })}
            </g>

            {/* landmasses */}
            <g stroke="#6f5a34" strokeWidth="3" strokeLinejoin="round">
              <path d={SWORD_COAST} fill="url(#land)" />
              <path d={STORMWRECK} fill="url(#land)" />
              <path d={SALTMARSH} fill="url(#land)" />
              {/* saltmarsh islets */}
              <circle cx="150" cy="215" r="20" fill="url(#land)" />
              <circle cx="432" cy="470" r="15" fill="url(#land)" />
              <circle cx="238" cy="150" r="12" fill="url(#land)" />
            </g>

            {/* a few hills on Stormwreck for flavour */}
            <g fill="#8a7442" stroke="#5f4d2a" strokeWidth="2" strokeLinejoin="round" opacity="0.9">
              <path d="M 980 700 l 34 -46 l 34 46 Z" />
              <path d="M 1020 712 l 28 -38 l 28 38 Z" />
              <path d="M 890 812 l 26 -34 l 26 34 Z" />
            </g>

            {/* region names (only where charted) */}
            {REGIONS.filter((r) => charted.includes(r.key)).map((r) => (
              <text key={r.key} x={r.lx} y={r.ly} textAnchor="middle"
                style={{ font: '600 34px var(--font-display, serif)', fill: '#4a3a1e', letterSpacing: '2px' }}
                opacity="0.7">{r.label}</text>
            ))}

            {/* fog of war over everything uncharted */}
            <g mask="url(#fogmask)" pointerEvents="none">
              <rect x="0" y="0" width={W} height={H} fill="#1f2b31" opacity="0.93" />
              <rect x="0" y="0" width={W} height={H} filter="url(#fognoise)" opacity="0.5" />
              <text x={W - 60} y={H - 40} textAnchor="end"
                style={{ font: 'italic 600 40px var(--font-display, serif)', fill: '#cdbd9a' }} opacity="0.35">
                Here be uncharted waters
              </text>
            </g>

            {/* compass rose (SW, over open sea) */}
            <g transform="translate(180,1210)" opacity="0.85" pointerEvents="none">
              <circle r="72" fill="none" stroke="#e9dcb6" strokeOpacity="0.5" strokeWidth="2" />
              <circle r="54" fill="none" stroke="#e9dcb6" strokeOpacity="0.35" strokeWidth="1" />
              {[0, 1, 2, 3].map((i) => (
                <g key={i} transform={`rotate(${i * 90})`}>
                  <path d="M 0 -70 L 12 0 L 0 14 L -12 0 Z" fill="#d9c78e" stroke="#6f5a34" strokeWidth="1" />
                </g>
              ))}
              {[0, 1, 2, 3].map((i) => (
                <path key={'d' + i} transform={`rotate(${45 + i * 90})`} d="M 0 -46 L 7 0 L 0 8 L -7 0 Z"
                  fill="#b49a5c" stroke="#6f5a34" strokeWidth="1" />
              ))}
              <text y="-78" textAnchor="middle" style={{ font: '700 22px var(--font-display, serif)', fill: '#efe4c4' }}>N</text>
            </g>

            {/* markers */}
            {visible.map((l) => {
              const p = localPos && localPos.id === l.id ? localPos : l
              const t = TYPES[l.type] || TYPES.landmark
              const known = !!l.discovered
              return (
                <g key={l.id}
                  transform={`translate(${Number(p.x)},${Number(p.y)}) scale(${inv})`}
                  style={{ cursor: canEdit ? 'grab' : 'pointer' }}
                  onPointerDown={(e) => onMarkerDown(e, l)}
                  onPointerMove={onMarkerMove}
                  onPointerUp={(e) => onMarkerUp(e, l)}
                  onPointerCancel={(e) => onMarkerUp(e, l)}
                >
                  <path d="M0 0 C -15 -22 -19 -36 0 -48 C 19 -36 15 -22 0 0 Z"
                    fill={known ? t.c : '#6b573a'} stroke="#2a1a0c" strokeWidth="2.5"
                    opacity={known ? 1 : 0.8} />
                  <circle cx="0" cy="-31" r="9" fill="#f7ecd2" stroke="#2a1a0c" strokeWidth="1" />
                  <text x="0" y="-26" textAnchor="middle" style={{ font: '13px serif', fill: '#2a1a0c' }}>
                    {known ? t.g : '?'}
                  </text>
                  <text x="0" y="17" textAnchor="middle"
                    style={{ font: '600 15px var(--font-ui, sans-serif)', paintOrder: 'stroke', stroke: '#f7ecd2', strokeWidth: 4, strokeLinejoin: 'round', fill: '#2a1a0c' }}>
                    {known ? l.name : '???'}
                  </text>
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
