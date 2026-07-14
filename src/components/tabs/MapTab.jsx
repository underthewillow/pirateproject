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
// String form of a reveal shape (fog cutout), for the offscreen fog rasterization below.
function shapeMarkup(s) {
  if (s.t === 'ellipse') return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="#000"/>`
  if (s.t === 'capsule') return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="#000" stroke-width="${s.r * 2}" stroke-linecap="round"/>`
  return ''
}
// String form of a free-hand eraser stroke (fog cutout), baked into the raster
// the same way charted regions are — see fog_reveals / the eraser tool below.
function strokeMarkup(s) {
  const dab = `<circle cx="${s.pts[0][0]}" cy="${s.pts[0][1]}" r="${s.r}" fill="#000"/>`
  if (!s.pts || s.pts.length < 2) return dab
  const pts = s.pts.map((p) => p.join(',')).join(' ')
  return `${dab}<polyline points="${pts}" fill="none" stroke="#000" stroke-width="${s.r * 2}" stroke-linecap="round" stroke-linejoin="round"/>`
}
// The fog-of-war (blur + procedural noise, masked by charted regions) never
// actually changes during pan/zoom — only its position on screen does. But
// living inside the transformed group as a *live* SVG filter meant every
// engine had to keep re-deriving those (fairly heavy) pixels on every single
// frame of a gesture. Desktop Chromium/Edge cache that well enough not to
// notice; mobile Safari does not, and that mismatch — identical code, fine on
// desktop, laggy on iOS — is what pointed at this specifically. Baking it to
// a plain PNG once (whenever the charted regions actually change) turns the
// per-frame cost into "transform a static image," which is cheap everywhere.
function buildFogSvgMarkup(W, H, chartedRegions, chartReveals = []) {
  const cutouts = chartedRegions.flatMap((r) => (r.shapes || []).map(shapeMarkup)).join('')
  const reveals = chartReveals.map(strokeMarkup).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <filter id="soft"><feGaussianBlur stdDeviation="26"/></filter>
      <filter id="feather"><feGaussianBlur stdDeviation="7"/></filter>
      <filter id="fognoise">
        <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="3" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.18  0 0 0 0 0.2  0 0 0 0.6 0"/>
      </filter>
      <mask id="fogmask">
        <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
        <g filter="url(#soft)">${cutouts}</g>
        <g filter="url(#feather)">${reveals}</g>
      </mask>
    </defs>
    <g mask="url(#fogmask)">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#0e1418" opacity="0.985"/>
      <rect x="0" y="0" width="${W}" height="${H}" filter="url(#fognoise)" opacity="0.6"/>
      <text x="${W * 0.70}" y="${H * 0.86}" text-anchor="middle" opacity="0.4"
        style="font: italic 600 34px Cinzel, 'IM Fell English SC', serif; fill:#d8c8a6">Here be uncharted waters</text>
      <text x="${W * 0.24}" y="${H * 0.7}" text-anchor="middle" opacity="0.32"
        style="font: italic 600 26px Cinzel, 'IM Fell English SC', serif; fill:#d8c8a6">terra incognita</text>
    </g>
  </svg>`
}
// Rasterizing through an actual <canvas> (HTML <img> → drawImage → PNG) is a
// far more battle-tested cross-browser path for "bake filter effects into a
// bitmap" than referencing an SVG-with-filters directly as an <image> src —
// the latter turned out to just drop the blur/noise filters and render the
// cutouts' raw bounding box in both Chromium and Safari. This hook rebuilds
// the fog PNG only when the actual content changes (not on every pan/zoom
// frame), and keeps the previous image on screen while the new one decodes
// so charting a new region doesn't flash back to a fully-fogged map.
function useFogImage(W, H, chartedRegions, chartReveals = []) {
  const [dataUrl, setDataUrl] = useState(null)
  const key = chartedRegions.map((r) => r.key).join(',')
  const revealKey = JSON.stringify(chartReveals) // small (a few coord pairs); rebake on add/undo/clear
  useEffect(() => {
    let cancelled = false
    const svgMarkup = buildFogSvgMarkup(W, H, chartedRegions, chartReveals)
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      canvas.getContext('2d').drawImage(img, 0, 0, W, H)
      setDataUrl(canvas.toDataURL('image/png'))
    }
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, key, revealKey])
  return dataUrl
}

export default function MapTab() {
  const { locations, settings, ship: vessel, addItem, patchItem, removeItem, setSetting, canEdit, isDM } = useData()
  const [chartKey, setChartKey] = useState('sea_of_swords')
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 })
  const [openId, setOpenId] = useState(null)
  const [placing, setPlacing] = useState(false)
  // DM/admin markers were draggable by default, so an accidental drag while
  // just trying to tap one (easy to trigger, especially on a touchscreen)
  // would silently relocate it. Off by default each session — same locked
  // behavior a player sees — until explicitly switched on to rearrange pins.
  const [moveMode, setMoveMode] = useState(false)
  const [localPos, setLocalPos] = useState(null) // {id,x,y} while dragging a marker
  const [erasing, setErasing] = useState(false)   // DM fog-eraser mode
  const [brush, setBrush] = useState(90)           // eraser radius in map units
  const [liveStroke, setLiveStroke] = useState(null) // in-progress eraser stroke
  const [localShip, setLocalShip] = useState(null)  // {x,y,heading} while dragging/rotating the ship

  const svgRef = useRef(null)
  const groupRef = useRef(null)
  const viewRef = useRef(view)
  const pointers = useRef(new Map())
  const pinchRef = useRef(null)
  const tapRef = useRef(null)
  const markerDrag = useRef(null)
  const strokeRef = useRef(null) // points of the eraser stroke currently being drawn
  const shipDrag = useRef(null)  // {mode:'move'|'rotate', moved} while interacting with the ship
  const markerRefs = useRef(new Map())
  const markersRef = useRef([])
  const localPosRef = useRef(null)
  const wheelCommitTimer = useRef(null)
  const extraFactorRef = useRef(1)
  // Markers are sized in fixed SVG viewBox units, counter-scaled by `inv` so
  // they stay a constant size independent of *zoom* — but the SVG itself also
  // scales to fit whatever width its container renders at, which is nowhere
  // near the same on a full desktop window vs. a narrow phone screen. Without
  // correcting for that too, the exact same marker ends up ~3x smaller on
  // mobile than desktop. Track the SVG's actual rendered width so marker size
  // can be normalized against it, landing on a consistent real on-screen size
  // everywhere.
  const [svgWidthPx, setSvgWidthPx] = useState(null)
  const pendingSvgWidthRef = useRef(null)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      // Applying this mid-gesture would re-render (and briefly re-mount) the
      // markers React is otherwise deliberately not touching during a pan or
      // pinch (see panImperative/zoomImperative) — defer it to onBgUp instead.
      if (pointers.current.size === 0) setSvgWidthPx(w)
      else pendingSvgWidthRef.current = w
    })
    ro.observe(svg)
    return () => ro.disconnect()
  }, [])
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
  // Free-hand fog reveals painted with the eraser. Each stroke: {chart, r, pts:[[x,y],…]}.
  const fogReveals = Array.isArray(settings?.fog_reveals) ? settings.fog_reveals : []
  const chartReveals = fogReveals.filter((s) => (s.chart || 'sea_of_swords') === chartKey)
  // Movable/rotatable ship marker. Stored as {chart,x,y,heading} in settings.ship_marker.
  const shipRaw = settings?.ship_marker && typeof settings.ship_marker === 'object' ? settings.ship_marker : null
  const shipOnChart = !!shipRaw && (shipRaw.chart || 'sea_of_swords') === chartKey
  const ship = shipOnChart ? { ...shipRaw, ...(localShip || {}) } : null

  // reset the view whenever we switch charts
  useEffect(() => { setView({ s: 1, tx: 0, ty: 0 }); setPlacing(false); setErasing(false); setLiveStroke(null); setLocalShip(null) }, [chartKey])

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
    const inv = extraFactorRef.current / next.s
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
    if (erasing && isDM) {
      svgRef.current?.setPointerCapture?.(e.pointerId)
      const w = worldFromClient(e.clientX, e.clientY)
      strokeRef.current = [[Math.round(clamp(w.x, 0, W)), Math.round(clamp(w.y, 0, H))]]
      setLiveStroke({ chart: chartKey, r: brush, pts: strokeRef.current.slice() })
      return
    }
    svgRef.current?.setPointerCapture?.(e.pointerId)
    if (pointers.current.size === 0) tapRef.current = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    pinchRef.current = null
  }
  const onBgMove = (e) => {
    if (erasing && isDM) {
      if (!strokeRef.current) return
      const w = worldFromClient(e.clientX, e.clientY)
      const pts = strokeRef.current
      const last = pts[pts.length - 1]
      if (Math.hypot(w.x - last[0], w.y - last[1]) >= brush * 0.35) {
        pts.push([Math.round(clamp(w.x, 0, W)), Math.round(clamp(w.y, 0, H))])
        setLiveStroke({ chart: chartKey, r: brush, pts: pts.slice() })
      }
      return
    }
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
    if (erasing && isDM) {
      svgRef.current?.releasePointerCapture?.(e.pointerId)
      const pts = strokeRef.current
      strokeRef.current = null
      setLiveStroke(null)
      if (pts && pts.length) setSetting('fog_reveals', [...fogReveals, { chart: chartKey, r: brush, pts }])
      return
    }
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
    if (pendingSvgWidthRef.current != null) {
      setSvgWidthPx(pendingSvgWidthRef.current)
      pendingSvgWidthRef.current = null
    }
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
    if (d.moved && canEdit && moveMode) {
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
    if (d.moved && canEdit && moveMode) {
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
  // undo the last eraser stroke on this chart; clear wipes them all (this chart only)
  const undoErase = () => {
    let last = -1
    fogReveals.forEach((s, i) => { if ((s.chart || 'sea_of_swords') === chartKey) last = i })
    if (last >= 0) setSetting('fog_reveals', fogReveals.filter((_, i) => i !== last))
  }
  const clearErase = () => setSetting('fog_reveals', fogReveals.filter((s) => (s.chart || 'sea_of_swords') !== chartKey))

  // ---- ship marker: drop, drag to move, drag the handle to set heading ----
  const placeShip = () => setSetting('ship_marker', { chart: chartKey, x: Math.round(W / 2), y: Math.round(H / 2), heading: shipRaw?.heading ?? 0 })
  const removeShip = () => { setLocalShip(null); setSetting('ship_marker', null) }
  const onShipDown = (e, mode) => {
    if (!shipEditable) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    shipDrag.current = { mode, moved: false }
  }
  const onShipMove = (e) => {
    const d = shipDrag.current
    if (!d) return
    e.stopPropagation()
    d.moved = true
    const w = worldFromClient(e.clientX, e.clientY)
    if (d.mode === 'move') {
      setLocalShip({ x: clamp(w.x, 0, W), y: clamp(w.y, 0, H), heading: shipRaw?.heading ?? 0 })
    } else {
      const heading = (Math.atan2(w.x - shipRaw.x, -(w.y - shipRaw.y)) * 180 / Math.PI + 360) % 360
      setLocalShip({ x: shipRaw.x, y: shipRaw.y, heading })
    }
  }
  const onShipUp = (e) => {
    const d = shipDrag.current
    if (!d) return
    e.stopPropagation()
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    shipDrag.current = null
    const ls = localShip
    setLocalShip(null)
    if (ls && d.moved) setSetting('ship_marker', { chart: chartKey, x: Math.round(ls.x), y: Math.round(ls.y), heading: Math.round(ls.heading) })
  }

  // markers for this chart; players see charted ones, editors see all
  const mine = locations.filter((l) => (l.chart || 'sea_of_swords') === chartKey)
  const visible = mine.filter((l) => canEdit || isCharted(l.region))
  const chartedRegions = regions.filter((r) => charted.includes(r.key))
  const openLoc = locations.find((l) => l.id === openId)
  // Only rebuilds when the actual fog content changes (charting a new region,
  // an eraser stroke, switching charts) — not on every pan/zoom frame. See useFogImage.
  const fogDataUrl = useFogImage(W, H, chartedRegions, chartReveals)
  // Cached for zoomImperative, which runs outside React's render cycle and
  // needs the current marker list/drag position without stale closures.
  markersRef.current = visible
  localPosRef.current = localPos
  // Normalizes marker size against the SVG's actual rendered width (see the
  // ResizeObserver above) so a marker is the same real on-screen size on a
  // phone as on a desktop window, then targets a modestly bigger, brighter
  // size than the map previously rendered at on desktop.
  const pxPerUnit = (svgWidthPx || W * 0.8) / W
  const MARKER_TARGET_DIAMETER_PX = 28
  const BASE_RING_R = 14
  const extraFactor = MARKER_TARGET_DIAMETER_PX / (2 * BASE_RING_R * pxPerUnit)
  extraFactorRef.current = extraFactor
  // Read from viewRef rather than view state directly — viewRef is always
  // current (kept live during pan/zoom gestures, synced from state otherwise),
  // so an unrelated re-render mid-gesture re-renders this with the correct
  // in-progress position instead of snapping back to stale committed state.
  const inv = extraFactor / viewRef.current.s
  const shipEditable = isDM && !erasing && !placing // ship is a DM-only tool, draggable in plain edit mode

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
            style={{ cursor: placing ? 'crosshair' : erasing ? 'cell' : 'grab', touchAction: 'none' }}
            onPointerDown={onBgDown}
            onPointerMove={onBgMove}
            onPointerUp={onBgUp}
            onPointerCancel={onBgUp}
          >
            <defs>
              <clipPath id="mapclip"><rect x="0" y="0" width={W} height={H} /></clipPath>
              {/* While an eraser stroke is in progress we can't re-bake the fog
                  PNG every frame, so reveal the in-progress stroke live by
                  masking a copy of the chart to it (see the overlay below). On
                  release the stroke is baked into the fog raster and this clears. */}
              {liveStroke && (
                <mask id="livereveal">
                  <rect x="0" y="0" width={W} height={H} fill="#000" />
                  <circle cx={liveStroke.pts[0][0]} cy={liveStroke.pts[0][1]} r={liveStroke.r} fill="#fff" />
                  {liveStroke.pts.length > 1 && (
                    <polyline points={liveStroke.pts.map((p) => p.join(',')).join(' ')} fill="none"
                      stroke="#fff" strokeWidth={liveStroke.r * 2} strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </mask>
              )}
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

              {/* fog of war over everything not yet charted — pre-rendered
                  (see useFogImage) instead of a live filter, so panning/
                  zooming only ever transforms a plain bitmap. Fully-fogged
                  placeholder rect covers the brief gap before the first
                  raster finishes decoding, rather than flashing the bare map. */}
              {fogDataUrl
                ? <image href={fogDataUrl} x="0" y="0" width={W} height={H} pointerEvents="none" clipPath="url(#mapclip)" />
                : <rect x="0" y="0" width={W} height={H} fill="#0e1418" opacity="0.985" pointerEvents="none" />}
              {/* live eraser feedback: a copy of the chart shown only through the
                  in-progress stroke, so fog appears to wipe away as you drag. */}
              {liveStroke && (
                <image href={assetUrl(chart.img)} xlinkHref={assetUrl(chart.img)} x="0" y="0" width={W} height={H}
                  preserveAspectRatio="none" mask="url(#livereveal)" pointerEvents="none" clipPath="url(#mapclip)" />
              )}

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
                    style={{ cursor: canEdit && moveMode ? 'grab' : 'pointer', opacity: faded ? 0.5 : 1, pointerEvents: erasing ? 'none' : undefined }}
                    onPointerDown={(e) => onMarkerDown(e, l)}
                    onPointerMove={onMarkerMove}
                    onPointerUp={(e) => onMarkerUp(e, l)}
                    onPointerCancel={(e) => onMarkerUp(e, l)}
                  >
                    <circle r="32" fill="#000" opacity="0" pointerEvents="all" />
                    <circle className="mm-pulse" r="16" fill="none" stroke={known ? t.c : '#6b573a'} strokeWidth="2" />
                    <circle className="mm-ring" r="14" fill={known ? t.c : '#6b573a'} fillOpacity="0.32"
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

              {/* ship marker — everyone sees it; editors drag to move and turn the
                  brass handle to set heading. Bow points the way it's travelling. */}
              {ship && (
                <g transform={`translate(${ship.x},${ship.y}) scale(${inv})`}>
                  {shipEditable && (
                    <g style={{ cursor: 'crosshair' }}
                      onPointerDown={(e) => onShipDown(e, 'rotate')}
                      onPointerMove={onShipMove}
                      onPointerUp={onShipUp}
                      onPointerCancel={onShipUp}>
                      <line x1="0" y1="0"
                        x2={Math.sin((ship.heading * Math.PI) / 180) * 56}
                        y2={-Math.cos((ship.heading * Math.PI) / 180) * 56}
                        stroke="#b08d3f" strokeWidth="2" strokeDasharray="4 3" opacity="0.9" />
                      <circle
                        cx={Math.sin((ship.heading * Math.PI) / 180) * 56}
                        cy={-Math.cos((ship.heading * Math.PI) / 180) * 56}
                        r="9" fill="#b08d3f" stroke="#2a1a0c" strokeWidth="2" pointerEvents="all" />
                      <text
                        x={Math.sin((ship.heading * Math.PI) / 180) * 56}
                        y={-Math.cos((ship.heading * Math.PI) / 180) * 56 + 4}
                        textAnchor="middle" style={{ font: '11px serif', fill: '#2a1a0c' }} pointerEvents="none">↻</text>
                    </g>
                  )}
                  <g transform={`rotate(${ship.heading})`}
                    style={{ cursor: shipEditable ? 'grab' : 'default' }}
                    onPointerDown={(e) => onShipDown(e, 'move')}
                    onPointerMove={onShipMove}
                    onPointerUp={onShipUp}
                    onPointerCancel={onShipUp}>
                    <circle r="30" fill="#000" opacity="0" pointerEvents={shipEditable ? 'all' : 'none'} />
                    <path d="M0,-30 C8,-20 13,-4 12,8 L9,20 Q0,27 -9,20 L-12,8 C-13,-4 -8,-20 0,-30 Z"
                      fill="#f4e6c4" stroke="#2a1a0c" strokeWidth="2.5" strokeLinejoin="round" />
                    <line x1="0" y1="-18" x2="0" y2="16" stroke="#7a5a2a" strokeWidth="2" />
                    <path d="M0,-16 L8,2 L0,2 Z" fill="#e9d7ad" stroke="#7a5a2a" strokeWidth="1.5" strokeLinejoin="round" />
                    <circle cx="0" cy="-26" r="2.6" fill="#8a2f2b" />
                  </g>
                  <g transform="translate(0,42)">
                    <text x="0" y="0" textAnchor="middle"
                      style={{ font: '700 15px var(--font-ui, sans-serif)', paintOrder: 'stroke', stroke: '#f7ecd2', strokeWidth: 5, strokeLinejoin: 'round', fill: '#2a1a0c' }}>
                      {vessel?.name || 'Our Ship'}
                    </text>
                  </g>
                </g>
              )}
            </g>
          </svg>

          {/* HUD: zoom + tools */}
          <div className="map-hud map-hud-tl">
            <button className="map-btn" title="Zoom in" onClick={() => zoomCenter(1.35)}>＋</button>
            <button className="map-btn" title="Zoom out" onClick={() => zoomCenter(1 / 1.35)}>－</button>
            <button className="map-btn" title="Reset view" onClick={() => setView({ s: 1, tx: 0, ty: 0 })}>⤢</button>
            {canEdit && (
              <button className={`map-btn wide ${placing ? 'active' : ''}`} onClick={() => { setErasing(false); setPlacing((p) => !p) }}>
                {placing ? '✕ cancel' : '＋ marker'}
              </button>
            )}
            {canEdit && (
              <button
                className={`map-btn wide ${moveMode ? 'active' : ''}`}
                title="When off, tapping a marker just opens it — same as a player sees — so an accidental drag can't relocate it"
                onClick={() => setMoveMode((m) => !m)}
              >
                {moveMode ? '🔓 move pins' : '🔒 pins locked'}
              </button>
            )}
            {isDM && (
              <>
                <button className={`map-btn wide ${erasing ? 'active' : ''}`} onClick={() => { setPlacing(false); setErasing((p) => !p) }}>
                  {erasing ? '✕ done erasing' : '⌫ fog eraser'}
                </button>
                <button className={`map-btn wide ${ship ? 'active' : ''}`}
                  onClick={() => { setPlacing(false); setErasing(false); ship ? removeShip() : placeShip() }}>
                  {ship ? '⚓ remove ship' : '⚓ place ship'}
                </button>
              </>
            )}
          </div>

          {placing && <div className="map-hint">Tap the chart to drop a marker</div>}
          {erasing && <div className="map-hint">Drag across the chart to wipe away the fog</div>}

          {canEdit && (
            <div className="map-hud map-hud-tr map-regions">
              <div className="eyebrow" style={{ marginBottom: 4 }}>Charted regions</div>
              {regions.map((r) => (
                <label key={r.key} className="flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={charted.includes(r.key)} onChange={() => toggleCharted(r.key)} />
                  {r.label}
                </label>
              ))}
              {erasing && (
                <>
                  <hr className="rule" style={{ margin: '8px 0 6px' }} />
                  <div className="eyebrow" style={{ marginBottom: 4 }}>Fog eraser</div>
                  <label className="flex gap-sm" style={{ alignItems: 'center', fontSize: 13 }}>
                    Brush
                    <input type="range" min="30" max="240" step="10" value={brush}
                      onChange={(e) => setBrush(Number(e.target.value))} style={{ flex: 1 }} />
                  </label>
                  <div className="flex gap-sm" style={{ marginTop: 6 }}>
                    <button className="map-btn wide" onClick={undoErase} disabled={!chartReveals.length}>↶ undo</button>
                    <button className="map-btn wide" onClick={clearErase} disabled={!chartReveals.length}>clear</button>
                  </div>
                </>
              )}
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
