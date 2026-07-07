import { useCallback, useEffect, useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import { assetUrl } from '../../lib/asset'
import Editable from '../common/Editable'
import Modal from '../common/Modal'

// ---------------------------------------------------------------------------
// CHARTS — each chart is one map. Add a new sea later by dropping an image in
// /public and adding an entry here (with its regions); markers carry a `chart`
// key so every chart keeps its own set of markings.
// ---------------------------------------------------------------------------
const CHARTS = [
  {
    key: 'sea_of_swords',
    name: 'The Sea of Swords',
    img: 'map.jpg',
    w: 1448,
    h: 1086,
    // A region is revealed (un-fogged) once its key is in settings.charted_regions.
    // Shapes: ellipse {t:'ellipse',cx,cy,rx,ry} or capsule {t:'capsule',x1,y1,x2,y2,r}.
    regions: [
      { key: 'stormwreck', label: 'Stormwreck Isle', shapes: [{ t: 'ellipse', cx: 632, cy: 500, rx: 235, ry: 210 }] },
      { key: 'neverwinter', label: 'Neverwinter & the Coast', shapes: [{ t: 'ellipse', cx: 1300, cy: 470, rx: 250, ry: 450 }] },
      { key: 'searoad', label: 'The Charted Sea-Road', shapes: [{ t: 'capsule', x1: 700, y1: 500, x2: 1170, y2: 460, r: 85 }] },
      { key: 'saltmarsh', label: 'Saltmarsh Approaches', shapes: [{ t: 'ellipse', cx: 175, cy: 220, rx: 235, ry: 235 }] },
    ],
  },
  {
    key: 'undiscovered',
    name: 'Undiscovered Seas',
    placeholder: true,
  },
]

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

// ---- geometry helpers ----
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy || 1
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = clamp(t, 0, 1)
  const cx = x1 + t * dx, cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}
function shapeHas(s, x, y) {
  if (s.t === 'ellipse') return ((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2 <= 1
  if (s.t === 'capsule') return distToSeg(x, y, s.x1, s.y1, s.x2, s.y2) <= s.r
  return false
}
function regionAt(regions, x, y) {
  for (const r of regions || []) if ((r.shapes || []).some((s) => shapeHas(s, x, y))) return r.key
  return ''
}
// Render one reveal shape (used inside the fog mask, painted black to cut fog).
function ShapeEl({ s, fill }) {
  if (s.t === 'ellipse') return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} />
  if (s.t === 'capsule') return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={fill} strokeWidth={s.r * 2} strokeLinecap="round" />
  return null
}

export default function MapTab() {
  const { locations, settings, addItem, patchItem, removeItem, setSetting, canEdit } = useData()
  const [chartKey, setChartKey] = useState('sea_of_swords')
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 })
  const [openId, setOpenId] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [localPos, setLocalPos] = useState(null) // {id,x,y} while dragging a marker

  const svgRef = useRef(null)
  const groupRef = useRef(null)
  const viewRef = useRef(view)
  const pointers = useRef(new Map())
  const pinchRef = useRef(null)
  const tapRef = useRef(null)
  const markerDrag = useRef(null)
  const markerRefs = useRef(new Map())
  const markersRef = useRef([])
  const localPosRef = useRef(null)
  const wheelCommitTimer = useRef(null)
  // Keep viewRef in sync with React state on ordinary renders — but not while
  // a pan/pinch gesture is in flight (see panImperative/zoomImperative below),
  // or an unrelated re-render (e.g. a Realtime update from something else in
  // the app) would stomp the in-progress imperative view and snap the map
  // back mid-gesture.
  if (pointers.current.size === 0) viewRef.current = view

  const chart = CHARTS.find((c) => c.key === chartKey) || CHARTS[0]
  const W = chart.w || 1448
  const H = chart.h || 1086
  const regions = chart.regions || []
  const charted = Array.isArray(settings?.charted_regions) ? settings.charted_regions : []
  const isCharted = (r) => !r || charted.includes(r)

  // reset the view whenever we switch charts
  useEffect(() => { setView({ s: 1, tx: 0, ty: 0 }); setPlacing(false) }, [chartKey])

  const clampView = useCallback((v) => {
    const s = clamp(v.s, 1, 6)
    return { s, tx: clamp(v.tx, W * (1 - s), 0), ty: clamp(v.ty, H * (1 - s), 0) }
  }, [W, H])

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

  // Discrete, single-shot zoom (HUD +/- buttons, reset view) — a plain React
  // state update is fine here since it's one click, not a continuous gesture.
  const zoomAround = useCallback((cx, cy, f) => {
    const vb = svgPoint(cx, cy)
    setView((v) => {
      const ns = clamp(v.s * f, 1, 6)
      const wx = (vb.x - v.tx) / v.s, wy = (vb.y - v.ty) / v.s
      return clampView({ s: ns, tx: vb.x - wx * ns, ty: vb.y - wy * ns })
    })
  }, [svgPoint, clampView])
  // Panning and continuous zoom (wheel/pinch) write straight to the DOM
  // instead of React state — both can fire dozens of times a second, and
  // running the whole map (fog mask, every marker) through React's
  // render/reconcile cycle on each one is what made panning and zooming feel
  // slow. Markers are nested inside the same transformed group, so a pure
  // pan moves them for free; a zoom also needs each marker's own counter-
  // scale updated (so glyphs stay a constant on-screen size), so those get
  // their transform attribute rewritten directly too. React state is
  // resynced once the gesture actually ends (onBgUp for pinch, a short
  // debounce for wheel, which has no discrete "end" event).
  const panImperative = useCallback((dx, dy) => {
    const next = clampView({ ...viewRef.current, tx: viewRef.current.tx + dx, ty: viewRef.current.ty + dy })
    viewRef.current = next
    groupRef.current?.setAttribute('transform', `translate(${next.tx},${next.ty}) scale(${next.s})`)
  }, [clampView])
  const zoomImperative = useCallback((cx, cy, f) => {
    const vb = svgPoint(cx, cy)
    const v = viewRef.current
    const ns = clamp(v.s * f, 1, 6)
    const wx = (vb.x - v.tx) / v.s, wy = (vb.y - v.ty) / v.s
    const next = clampView({ s: ns, tx: vb.x - wx * ns, ty: vb.y - wy * ns })
    viewRef.current = next
    groupRef.current?.setAttribute('transform', `translate(${next.tx},${next.ty}) scale(${next.s})`)
    const inv = 1 / next.s
    for (const l of markersRef.current) {
      const node = markerRefs.current.get(l.id)
      if (!node) continue
      const lp = localPosRef.current
      const p = lp && lp.id === l.id ? lp : l
      node.setAttribute('transform', `translate(${Number(p.x)},${Number(p.y)}) scale(${inv})`)
    }
  }, [svgPoint, clampView])

  // wheel zoom (manual listener so we can preventDefault)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e) => {
      e.preventDefault()
      zoomImperative(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18)
      clearTimeout(wheelCommitTimer.current)
      wheelCommitTimer.current = setTimeout(() => setView(viewRef.current), 150)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => { svg.removeEventListener('wheel', onWheel); clearTimeout(wheelCommitTimer.current) }
  }, [zoomImperative, chartKey])

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
      if (pinchRef.current) zoomImperative(mid.x, mid.y, dist / pinchRef.current)
      pinchRef.current = dist
      tapRef.current = null
    } else {
      const A = svgPoint(prev.x, prev.y), B = svgPoint(e.clientX, e.clientY)
      panImperative(B.x - A.x, B.y - A.y)
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
    // Commit the final imperative pan position into React state now that the
    // gesture has ended (harmless no-op if this was a pinch-zoom instead,
    // which already keeps state in sync via zoomAround's setView calls).
    setView(viewRef.current)
  }

  // No window.prompt (the desktop app blocks it) — create the marker, then open
  // its card so it can be named and described inline.
  const addMarkerAt = async (cx, cy) => {
    const w = worldFromClient(cx, cy)
    if (w.x < 0 || w.x > W || w.y < 0 || w.y > H) { setPlacing(false); return }
    setPlacing(false)
    const row = await addItem('locations', {
      name: 'New marking', description: '', x: Math.round(w.x), y: Math.round(w.y),
      discovered: true, type: 'landmark', region: regionAt(regions, w.x, w.y), chart: chartKey,
    })
    if (row?.id) setOpenId(row.id)
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
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) d.moved = true
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
      patchItem('locations', loc.id, { x: Math.round(clamp(w.x, 0, W)), y: Math.round(clamp(w.y, 0, H)), region: regionAt(regions, w.x, w.y) })
    } else if (loc.discovered || canEdit) {
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

  // markers for this chart; players see charted ones, editors see all
  const mine = locations.filter((l) => (l.chart || 'sea_of_swords') === chartKey)
  const visible = mine.filter((l) => canEdit || isCharted(l.region))
  const chartedRegions = regions.filter((r) => charted.includes(r.key))
  const openLoc = locations.find((l) => l.id === openId)
  // Cached for zoomImperative, which runs outside React's render cycle and
  // needs the current marker list/drag position without stale closures.
  markersRef.current = visible
  localPosRef.current = localPos
  // Read from viewRef rather than view state directly — viewRef is always
  // current (kept live during pan/zoom gestures, synced from state otherwise),
  // so an unrelated re-render mid-gesture re-renders this with the correct
  // in-progress position instead of snapping back to stale committed state.
  const inv = 1 / viewRef.current.s

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: 2 }}>The Chart</h2>
          <p className="map-tagline">Maps may or may not be drawn to scale.</p>
        </div>
      </div>

      {/* chart switcher */}
      <div className="map-charttabs">
        {CHARTS.map((c) => (
          <button key={c.key} className={`map-charttab ${c.key === chartKey ? 'active' : ''}`} onClick={() => setChartKey(c.key)}>
            {c.name}
          </button>
        ))}
      </div>

      <p className="muted" style={{ margin: '0 0 4px' }}>
        {chart.placeholder
          ? 'Waters the crew has not yet sailed.'
          : 'Drag to sail the chart · scroll or pinch to zoom · tap a charted landfall to read its notes.'}
      </p>

      {chart.placeholder ? (
        <div className="map-wrap map-undiscovered">
          <div className="map-undiscovered-inner">
            <div className="map-undiscovered-mark">✶</div>
            <h3>Undiscovered Seas</h3>
            <p className="muted">Beyond the Sea of Swords the charts run blank. Whatever lies out here — other seas,
              far ports, monsters in the deep — will be drawn in as the crew sails it.</p>
            <div className="card" style={{ marginTop: 12, textAlign: 'left' }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Rumours &amp; hearsay</div>
              <Editable as="div" multiline
                placeholder={canEdit ? 'Note down rumours of what lies beyond…' : 'No rumours recorded yet.'}
                value={settings?.undiscovered_note || ''}
                onCommit={(v) => setSetting('undiscovered_note', v)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="map-wrap">
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
              <filter id="soft"><feGaussianBlur stdDeviation="26" /></filter>
              <filter id="fognoise">
                <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="3" seed="7" result="n" />
                <feColorMatrix in="n" type="matrix"
                  values="0 0 0 0 0.13  0 0 0 0 0.18  0 0 0 0 0.2  0 0 0 0.6 0" />
              </filter>
              <clipPath id="mapclip"><rect x="0" y="0" width={W} height={H} /></clipPath>
              {/* fog mask: white = fogged, black cut-outs = charted/revealed */}
              <mask id="fogmask">
                <rect x="0" y="0" width={W} height={H} fill="#fff" />
                <g filter="url(#soft)">
                  {chartedRegions.flatMap((r) => r.shapes.map((s, i) => <ShapeEl key={r.key + i} s={s} fill="#000" />))}
                </g>
              </mask>
            </defs>

            {/* will-change hints the browser to composite this subtree (chart
                image + the blurred/noisy fog-of-war filter effects) as its own
                cached layer rather than re-rendering the filters from scratch
                on every pan/zoom frame — mobile Safari in particular is known
                to be much weaker than desktop at caching filtered SVG content
                across transform changes without this hint. */}
            <g ref={groupRef} style={{ willChange: 'transform' }} transform={`translate(${viewRef.current.tx},${viewRef.current.ty}) scale(${viewRef.current.s})`} clipPath="url(#mapclip)">
              {/* painted chart */}
              <image href={assetUrl(chart.img)} xlinkHref={assetUrl(chart.img)} x="0" y="0" width={W} height={H} preserveAspectRatio="none" />

              {/* fog of war over everything not yet charted */}
              <g mask="url(#fogmask)" pointerEvents="none" clipPath="url(#mapclip)">
                <rect x="0" y="0" width={W} height={H} fill="#1f2b31" opacity="0.92" />
                <rect x="0" y="0" width={W} height={H} filter="url(#fognoise)" opacity="0.5" />
                <text x={W * 0.70} y={H * 0.86} textAnchor="middle"
                  style={{ font: 'italic 600 34px var(--font-display, serif)', fill: '#d8c8a6' }} opacity="0.4">
                  Here be uncharted waters
                </text>
                <text x={W * 0.24} y={H * 0.7} textAnchor="middle"
                  style={{ font: 'italic 600 26px var(--font-display, serif)', fill: '#d8c8a6' }} opacity="0.32">
                  terra incognita
                </text>
              </g>

              {/* markers */}
              {visible.map((l) => {
                const p = localPos && localPos.id === l.id ? localPos : l
                const t = TYPES[l.type] || TYPES.landmark
                const known = !!l.discovered
                const faded = canEdit && !isCharted(l.region) // editor-only preview of un-revealed pins
                return (
                  <g key={l.id}
                    ref={(node) => { if (node) markerRefs.current.set(l.id, node); else markerRefs.current.delete(l.id) }}
                    className="map-marker"
                    transform={`translate(${Number(p.x)},${Number(p.y)}) scale(${inv})`}
                    style={{ cursor: canEdit ? 'grab' : 'pointer', opacity: faded ? 0.5 : 1 }}
                    onPointerDown={(e) => onMarkerDown(e, l)}
                    onPointerMove={onMarkerMove}
                    onPointerUp={(e) => onMarkerUp(e, l)}
                    onPointerCancel={(e) => onMarkerUp(e, l)}
                  >
                    <circle r="32" fill="#000" opacity="0" pointerEvents="all" />
                    <circle className="mm-pulse" r="16" fill="none" stroke={known ? t.c : '#6b573a'} strokeWidth="2" />
                    <circle className="mm-ring" r="14" fill={known ? t.c : '#6b573a'} fillOpacity="0.25"
                      stroke={known ? t.c : '#6b573a'} strokeWidth="3" />
                    <text className="mm-glyph" x="0" y="6" textAnchor="middle"
                      style={{ font: '17px serif', fill: known ? t.c : '#6b573a' }}>{known ? t.g : '?'}</text>
                    <g className="mm-label" transform="translate(0,-26)">
                      <text x="0" y="0" textAnchor="middle"
                        style={{ font: '600 17px var(--font-ui, sans-serif)', paintOrder: 'stroke', stroke: '#f7ecd2', strokeWidth: 5, strokeLinejoin: 'round', fill: '#2a1a0c' }}>
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
              {regions.map((r) => (
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
      )}

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
              <select className="select" style={{ width: 190 }} value={openLoc.region || ''}
                onChange={(e) => patchItem('locations', openLoc.id, { region: e.target.value })}>
                <option value="">Open sea</option>
                {regions.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            ) : (
              <span className="badge">{regions.find((r) => r.key === openLoc.region)?.label || 'Open sea'}</span>
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
