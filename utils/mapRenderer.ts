// Canvas renderer for the robot maps (Mapping and Navigation pages).
//
// Draws an occupancy grid, costmaps, robots, docks and paths in the map frame, with a camera
// that fits the map, follows a robot or is panned/zoomed by the user. Colours come from CSS
// custom properties on the host element (see MapViewer.vue), so the look lives in one place.
import type { Pose2D } from './dockMarkers'

export interface MapGrid {
  width: number
  height: number
  resolution: number
  /** pose of cell (0, 0)'s corner in the map frame */
  origin: Pose2D
  /** row-major, row 0 at origin.y, values -1 (unknown) or 0..100 */
  data: ArrayLike<number>
}

export interface RobotMeta {
  id: string
  color: string
  label?: string
  /** draw this robot's path (e.g. only while it is navigating) */
  showPath?: boolean
}

export interface MapDockMarker {
  id: string
  /** marker position on the wall, map frame */
  x: number
  y: number
  /** robot heading when facing the marker (marker faces theta + pi) */
  theta: number
  /** 'pin' = round badge (detected while mapping), 'tile' = square badge (configured dock) */
  shape: 'pin' | 'tile'
  badge: string
  label: string
  /** 1..4 settledness ring around a pin */
  level?: number
  muted?: boolean
  /** tile filled with this colour, e.g. the robot docked there */
  fill?: string | null
  hasItem?: boolean
}

export interface MapLayers {
  globalCostmap: boolean
  localCostmap: boolean
  paths: boolean
  labels: boolean
}

export type CameraMode = 'fit' | 'follow' | 'free'
export type CostmapKind = 'global' | 'local'

export interface RendererCallbacks {
  onSelectRobot?: (id: string) => void
  onSelectDock?: (id: string) => void
  onCursor?: (p: { x: number; y: number } | null) => void
  onModeChange?: (mode: CameraMode) => void
}

/** nav_msgs/OccupancyGrid (as delivered by roslibjs) -> MapGrid */
export function gridFromMessage(msg: any): MapGrid {
  const info = msg.info
  const q = info.origin.orientation ?? { x: 0, y: 0, z: 0, w: 1 }
  return {
    width: info.width,
    height: info.height,
    resolution: info.resolution,
    origin: {
      x: info.origin.position.x,
      y: info.origin.position.y,
      yaw: Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))
    },
    data: msg.data
  }
}

interface Palette {
  unknown: number[]; free: number[]; wall: number[]; cost: number[]; local: number[]
  grid: string; ink: string; surface: string; muted: string; line: string
  accent: string; dock: string; item: string; font: string; mono: string
}

interface Layer { grid: MapGrid; image: HTMLCanvasElement }

const TRAIL_SECONDS = 40
const MIN_SCALE = 5
const MAX_SCALE = 400

export class MapRenderer {
  private el: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cb: RendererCallbacks
  private dpr = 1
  private cw = 1
  private ch = 1
  private cam = { x: 0, y: 0, s: 40, ready: false }
  private mode: CameraMode = 'fit'
  private followScale = 60
  private followId: string | null = null
  private trailId: string | null = null
  private trail: { x: number; y: number; t: number }[] = []
  private palette!: Palette
  private map: Layer | null = null
  private costmaps: Partial<Record<CostmapKind, Layer>> = {}
  private robots = new Map<string, { meta: RobotMeta; pose?: Pose2D }>()
  private paths = new Map<string, [number, number][]>()
  private docks: MapDockMarker[] = []
  private selectedRobot: string | null = null
  private selectedDock: string | null = null
  private layers: MapLayers = { globalCostmap: true, localCostmap: true, paths: true, labels: true }
  private fitPadTop = 28
  private raf = 0
  private lastFrame = 0
  private drag: { x: number; y: number; moved: number } | null = null
  private resizeObserver: ResizeObserver
  private reduceMotion = false
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = []

  constructor(el: HTMLElement, canvas: HTMLCanvasElement, callbacks: RendererCallbacks = {}) {
    this.el = el
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.cb = callbacks
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    this.readPalette()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(el)
    this.resize()
    this.bindInput()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.listeners.forEach(([target, type, fn, opts]) => target.removeEventListener(type, fn, opts))
    this.listeners = []
  }

  // ------------------------------------------------------------------------------ data in

  setGrid(grid: MapGrid | null) {
    const first = !this.map
    this.map = grid ? { grid, image: this.buildImage(grid, this.mapLut()) } : null
    if (first && grid) this.cam.ready = false  // snap to the first map instead of easing in
  }

  setCostmap(kind: CostmapKind, grid: MapGrid | null) {
    if (!grid) { delete this.costmaps[kind]; return }
    this.costmaps[kind] = { grid, image: this.buildImage(grid, kind === 'global' ? this.globalLut() : this.localLut()) }
  }

  /** Replace the set of robots (colour/label); robots not listed are removed. */
  setRobotMeta(list: RobotMeta[]) {
    const ids = new Set(list.map(r => r.id))
    for (const id of [...this.robots.keys()]) {
      if (!ids.has(id)) { this.robots.delete(id); this.paths.delete(id) }
    }
    list.forEach((meta) => {
      const entry = this.robots.get(meta.id)
      if (entry) entry.meta = meta
      else this.robots.set(meta.id, { meta })
    })
  }

  setRobotPose(id: string, pose: Pose2D) {
    const entry = this.robots.get(id)
    if (!entry) return
    entry.pose = pose
    if (id === this.trailId) {
      const now = performance.now() / 1000
      const last = this.trail[this.trail.length - 1]
      if (!last || Math.hypot(last.x - pose.x, last.y - pose.y) > 0.05) this.trail.push({ x: pose.x, y: pose.y, t: now })
      while (this.trail.length && now - this.trail[0].t > TRAIL_SECONDS) this.trail.shift()
    }
  }

  setPath(id: string, points: [number, number][] | null) {
    if (points && points.length > 1) this.paths.set(id, points)
    else this.paths.delete(id)
  }

  setDocks(docks: MapDockMarker[]) { this.docks = docks }

  setSelection(robotId: string | null, dockId: string | null) {
    this.selectedRobot = robotId
    this.selectedDock = dockId
  }

  setLayers(layers: Partial<MapLayers>) { this.layers = { ...this.layers, ...layers } }
  setFitPadTop(px: number) { this.fitPadTop = px }
  setFollowTarget(id: string | null) { this.followId = id }

  setTrailRobot(id: string | null) {
    if (id !== this.trailId) this.trail = []
    this.trailId = id
  }

  clearTrail() { this.trail = [] }

  /** Drop everything (robot switched / disconnected). */
  clear() {
    this.map = null
    this.costmaps = {}
    this.robots.clear()
    this.paths.clear()
    this.docks = []
    this.trail = []
    this.cam.ready = false
    this.setMode('fit')
  }

  // ------------------------------------------------------------------------------ camera

  setMode(mode: CameraMode) {
    if (mode === 'follow' && this.mode !== 'follow') this.followScale = Math.max(this.cam.s, 60)
    this.mode = mode
    this.cb.onModeChange?.(mode)
  }

  zoomBy(factor: number) {
    if (this.mode === 'follow') { this.followScale = clamp(this.followScale * factor, MIN_SCALE, MAX_SCALE); return }
    this.setMode('free')
    this.zoomAt(this.cw / 2, this.ch / 2, factor)
  }

  private zoomAt(px: number, py: number, factor: number) {
    const x = this.wx(px), y = this.wy(py)
    this.cam.s = clamp(this.cam.s * factor, MIN_SCALE, MAX_SCALE)
    this.cam.x = x - (px - this.cw / 2) / this.cam.s
    this.cam.y = y + (py - this.ch / 2) / this.cam.s
  }

  private sx = (x: number) => this.cw / 2 + (x - this.cam.x) * this.cam.s
  private sy = (y: number) => this.ch / 2 - (y - this.cam.y) * this.cam.s
  private wx = (px: number) => this.cam.x + (px - this.cw / 2) / this.cam.s
  private wy = (py: number) => this.cam.y - (py - this.ch / 2) / this.cam.s

  private fitTarget() {
    if (!this.map) return null
    const g = this.map.grid
    const w = g.width * g.resolution, h = g.height * g.resolution
    const c = Math.cos(g.origin.yaw), s = Math.sin(g.origin.yaw)
    const xs: number[] = [], ys: number[] = []
    for (const [u, v] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      xs.push(g.origin.x + c * u - s * v)
      ys.push(g.origin.y + s * u + c * v)
    }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const pad = 28, availH = this.ch - this.fitPadTop - pad
    const scale = Math.max(MIN_SCALE, Math.min((this.cw - 2 * pad) / (x1 - x0), availH / (y1 - y0)))
    // centre the map in the area below the top overlay
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + (this.fitPadTop + availH / 2 - this.ch / 2) / scale, s: scale }
  }

  private updateCamera(dt: number) {
    let target: { x: number; y: number; s: number } | null = null
    if (this.mode === 'fit') target = this.fitTarget()
    else if (this.mode === 'follow') {
      const id = this.followId ?? this.selectedRobot
      const pose = id ? this.robots.get(id)?.pose : undefined
      if (pose) target = { x: pose.x, y: pose.y, s: this.followScale }
    }
    if (!target) return
    if (!this.cam.ready || this.reduceMotion) {
      Object.assign(this.cam, target)
      this.cam.ready = true
      return
    }
    const k = 1 - Math.exp(-dt * 5)
    this.cam.x += (target.x - this.cam.x) * k
    this.cam.y += (target.y - this.cam.y) * k
    this.cam.s = Math.exp(Math.log(this.cam.s) + (Math.log(target.s) - Math.log(this.cam.s)) * k)
  }

  // ------------------------------------------------------------------------------ input

  private on(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
    target.addEventListener(type, fn, opts)
    this.listeners.push([target, type, fn, opts])
  }

  private local(e: MouseEvent) {
    const r = this.el.getBoundingClientRect()
    return { px: e.clientX - r.left, py: e.clientY - r.top }
  }

  private bindInput() {
    const el = this.el
    this.on(el, 'wheel', ((e: WheelEvent) => {
      if ((e.target as Element).closest('button, .mv-chip')) return
      e.preventDefault()
      const f = Math.exp(-e.deltaY * 0.0015)
      if (this.mode === 'follow') { this.followScale = clamp(this.followScale * f, MIN_SCALE, MAX_SCALE); return }
      const { px, py } = this.local(e)
      this.setMode('free')
      this.zoomAt(px, py, f)
    }) as EventListener, { passive: false })
    this.on(el, 'pointerdown', ((e: PointerEvent) => {
      if ((e.target as Element).closest('button, .mv-chip')) return
      this.drag = { x: e.clientX, y: e.clientY, moved: 0 }
      el.setPointerCapture(e.pointerId)
      el.classList.add('mv-dragging')
    }) as EventListener)
    this.on(el, 'pointermove', ((e: PointerEvent) => {
      const { px, py } = this.local(e)
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y
        this.drag.moved += Math.abs(dx) + Math.abs(dy)
        if (this.drag.moved > 4) {
          if (this.mode !== 'free') this.setMode('free')
          this.cam.x -= dx / this.cam.s
          this.cam.y += dy / this.cam.s
        }
        this.drag.x = e.clientX
        this.drag.y = e.clientY
      }
      if ((e.target as Element).closest('button, .mv-chip')) this.cb.onCursor?.(null)
      else if (this.map) this.cb.onCursor?.({ x: this.wx(px), y: this.wy(py) })
    }) as EventListener)
    this.on(el, 'pointerup', ((e: PointerEvent) => {
      if (this.drag && this.drag.moved <= 4) {
        const { px, py } = this.local(e)
        this.click(px, py)
      }
      this.drag = null
      el.classList.remove('mv-dragging')
    }) as EventListener)
    this.on(el, 'pointercancel', (() => { this.drag = null; el.classList.remove('mv-dragging') }) as EventListener)
    this.on(el, 'pointerleave', (() => this.cb.onCursor?.(null)) as EventListener)
  }

  private click(px: number, py: number) {
    for (const [id, r] of this.robots) {
      if (!r.pose) continue
      const hit = Math.max(14, 0.3 * this.cam.s)
      if (Math.hypot(this.sx(r.pose.x) - px, this.sy(r.pose.y) - py) < hit) { this.cb.onSelectRobot?.(id); return }
    }
    for (const d of this.docks) {
      const b = this.dockBadge(d)
      if (Math.hypot(b.x - px, b.y - py) < 15) { this.cb.onSelectDock?.(d.id); return }
    }
  }

  // ------------------------------------------------------------------------------ images

  readPalette() {
    const cs = getComputedStyle(this.el)
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
    this.palette = {
      unknown: toRgb(v('--mv-unknown', '#e3e8ee')),
      free: toRgb(v('--mv-free', '#fbfcfd')),
      wall: toRgb(v('--mv-wall', '#1e2a36')),
      cost: toRgb(v('--mv-cost', '#6741d9')),
      local: toRgb(v('--mv-local', '#e67700')),
      grid: v('--mv-grid', 'rgba(30, 42, 54, 0.08)'),
      ink: v('--mv-ink', '#16202b'),
      surface: v('--mv-surface', '#ffffff'),
      muted: v('--mv-muted', '#8a96a3'),
      line: v('--mv-line', '#d6dce3'),
      accent: v('--mv-accent', '#e8590c'),
      dock: v('--mv-dock', '#1c6fd1'),
      item: v('--mv-item', '#f59f00'),
      font: cs.fontFamily || 'sans-serif',
      mono: v('--mv-mono', 'ui-monospace, Menlo, monospace')
    }
    if (this.map) this.setGrid(this.map.grid)
    for (const kind of Object.keys(this.costmaps) as CostmapKind[]) this.setCostmap(kind, this.costmaps[kind]!.grid)
  }

  /** RGBA lookup for values -1..100 (index value + 1) */
  private lut(fn: (v: number) => [number, number, number, number]) {
    const out = new Uint8ClampedArray(102 * 4)
    for (let v = -1; v <= 100; v++) out.set(fn(v), (v + 1) * 4)
    return out
  }

  private mapLut() {
    const { unknown, free, wall } = this.palette
    return this.lut((v) => {
      if (v < 0) return [unknown[0], unknown[1], unknown[2], 255]
      // probabilities between slam_toolbox's free / occupied thresholds blend smoothly
      const t = v <= 25 ? 0 : v >= 65 ? 1 : (v - 25) / 40
      return [mix(free[0], wall[0], t), mix(free[1], wall[1], t), mix(free[2], wall[2], t), 255]
    })
  }

  private globalLut() {
    const c = this.palette.cost
    return this.lut((v) => {
      // inflation gets stronger towards obstacles; lethal cells (100) are walls, drawn by the map,
      // or new obstacles from the obstacle layer, which need to stand out
      const a = v <= 0 ? 0 : v >= 100 ? 0.55 : v >= 99 ? 0.42 : 0.05 + 0.3 * Math.pow(v / 98, 1.4)
      return [c[0], c[1], c[2], Math.round(a * 255)]
    })
  }

  private localLut() {
    const c = this.palette.local
    return this.lut((v) => {
      const a = v <= 0 ? 0 : v >= 100 ? 0.85 : v >= 99 ? 0.45 : 0.2
      return [c[0], c[1], c[2], Math.round(a * 255)]
    })
  }

  /** Image with row 0 = grid row 0; drawn through a y-up transform (see drawLayer). */
  private buildImage(grid: MapGrid, lut: Uint8ClampedArray) {
    const image = document.createElement('canvas')
    image.width = Math.max(1, grid.width)
    image.height = Math.max(1, grid.height)
    const ctx = image.getContext('2d')!
    const img = ctx.createImageData(image.width, image.height)
    const px = img.data, data = grid.data, n = Math.min(data.length, grid.width * grid.height)
    for (let i = 0; i < n; i++) {
      let v = data[i]
      if (v < -1 || v > 100) v = -1
      const k = (v + 1) * 4, p = i * 4
      px[p] = lut[k]; px[p + 1] = lut[k + 1]; px[p + 2] = lut[k + 2]; px[p + 3] = lut[k + 3]
    }
    ctx.putImageData(img, 0, 0)
    return image
  }

  // ------------------------------------------------------------------------------ drawing

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.max(0, Math.min(0.1, (now - (this.lastFrame || now)) / 1000))
    this.lastFrame = now
    if (document.hidden || this.cw < 2) return
    this.updateCamera(dt)
    this.draw(now)
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    const r = this.el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return
    this.cw = r.width
    this.ch = r.height
    this.canvas.width = Math.round(this.cw * this.dpr)
    this.canvas.height = Math.round(this.ch * this.dpr)
  }

  private screenTransform() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  /** Draw a grid image placed at its origin pose (rotation included), in metres. */
  private drawLayer(layer: Layer) {
    const g = layer.grid, s = this.cam.s, d = this.dpr
    const c = Math.cos(g.origin.yaw), sn = Math.sin(g.origin.yaw)
    const e = this.sx(g.origin.x), f = this.sy(g.origin.y)
    this.ctx.setTransform(d * s * c, -d * s * sn, -d * s * sn, -d * s * c, d * e, d * f)
    this.ctx.imageSmoothingEnabled = false
    this.ctx.drawImage(layer.image, 0, 0, g.width * g.resolution, g.height * g.resolution)
    this.screenTransform()
  }

  private draw(now: number) {
    const ctx = this.ctx, P = this.palette
    this.screenTransform()
    ctx.fillStyle = rgb(P.unknown)
    ctx.fillRect(0, 0, this.cw, this.ch)
    if (!this.map) return

    this.drawLayer(this.map)
    if (this.layers.globalCostmap && this.costmaps.global) this.drawLayer(this.costmaps.global)
    this.drawGridLines()
    if (this.layers.localCostmap && this.costmaps.local) {
      this.drawLayer(this.costmaps.local)
      this.outlineLayer(this.costmaps.local, rgb(P.local))
    }
    this.drawTrail()
    if (this.layers.paths) this.drawPaths()
    this.docks.forEach(d => this.drawDock(d))
    this.drawRobots(now)
    this.drawScaleBar()
  }

  private drawGridLines() {
    const ctx = this.ctx
    if (this.cam.s <= 18) return
    ctx.strokeStyle = this.palette.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = Math.ceil(this.wx(0)); x <= this.wx(this.cw); x++) {
      const p = Math.round(this.sx(x)) + 0.5
      ctx.moveTo(p, 0); ctx.lineTo(p, this.ch)
    }
    for (let y = Math.ceil(this.wy(this.ch)); y <= this.wy(0); y++) {
      const p = Math.round(this.sy(y)) + 0.5
      ctx.moveTo(0, p); ctx.lineTo(this.cw, p)
    }
    ctx.stroke()
  }

  private outlineLayer(layer: Layer, color: string) {
    const g = layer.grid, ctx = this.ctx
    const w = g.width * g.resolution, h = g.height * g.resolution
    const c = Math.cos(g.origin.yaw), s = Math.sin(g.origin.yaw)
    const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([u, v]) =>
      [this.sx(g.origin.x + c * u - s * v), this.sy(g.origin.y + s * u + c * v)])
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawTrail() {
    const pts = this.trail, ctx = this.ctx
    if (!this.trailId || pts.length < 2) return
    const color = this.robots.get(this.trailId)?.meta.color ?? this.palette.accent
    const now = performance.now() / 1000
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, 0.08 * this.cam.s)
    for (let i = 1; i < pts.length; i++) {
      ctx.globalAlpha = 0.05 + 0.5 * Math.max(0, 1 - (now - pts[i].t) / TRAIL_SECONDS)
      ctx.beginPath()
      ctx.moveTo(this.sx(pts[i - 1].x), this.sy(pts[i - 1].y))
      ctx.lineTo(this.sx(pts[i].x), this.sy(pts[i].y))
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  private drawPaths() {
    const ctx = this.ctx
    for (const [id, pts] of this.paths) {
      const robot = this.robots.get(id)
      if (!robot || !robot.meta.showPath) continue
      // skip the part the robot has already driven
      let start = 0
      if (robot.pose) {
        let best = Infinity
        pts.forEach(([x, y], k) => {
          const d = Math.hypot(x - robot.pose!.x, y - robot.pose!.y)
          if (d < best) { best = d; start = k }
        })
      }
      const rest: [number, number][] = robot.pose ? [[robot.pose.x, robot.pose.y], ...pts.slice(start + 1)] : pts
      if (rest.length < 2) continue
      const selected = id === this.selectedRobot, w = selected ? 3.5 : 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      rest.forEach(([x, y], k) => (k ? ctx.lineTo(this.sx(x), this.sy(y)) : ctx.moveTo(this.sx(x), this.sy(y))))
      ctx.strokeStyle = this.palette.surface
      ctx.lineWidth = w + 3
      ctx.globalAlpha = 0.8
      ctx.stroke()
      ctx.strokeStyle = robot.meta.color
      ctx.lineWidth = w
      ctx.globalAlpha = selected ? 1 : 0.75
      ctx.stroke()
      ctx.globalAlpha = 1
      const [gx, gy] = rest[rest.length - 1]
      ctx.beginPath()
      ctx.arc(this.sx(gx), this.sy(gy), 5, 0, Math.PI * 2)
      ctx.fillStyle = this.palette.surface
      ctx.fill()
      ctx.lineWidth = 2.5
      ctx.strokeStyle = robot.meta.color
      ctx.stroke()
    }
  }

  private dockBadge(d: MapDockMarker) {
    const myaw = d.theta - Math.PI  // marker faces opposite the docking heading
    return { x: this.sx(d.x + 0.18 * Math.cos(myaw)), y: this.sy(d.y + 0.18 * Math.sin(myaw)) }
  }

  private drawDock(d: MapDockMarker) {
    const ctx = this.ctx, P = this.palette
    const selected = d.id === this.selectedDock
    const color = d.muted ? P.muted : d.shape === 'pin' ? P.dock : P.ink
    const myaw = d.theta - Math.PI
    const b = this.dockBadge(d)
    const ax = this.sx(d.x + 0.7 * Math.cos(myaw)), ay = this.sy(d.y + 0.7 * Math.sin(myaw))

    // where the robot stands to dock
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.globalAlpha = 0.8
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ax, ay); ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath(); ctx.arc(ax, ay, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = P.surface; ctx.fill(); ctx.stroke()
    ctx.globalAlpha = 1

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (d.shape === 'pin') {
      if (selected) {
        ctx.beginPath(); ctx.arc(b.x, b.y, 19, 0, Math.PI * 2)
        ctx.fillStyle = withAlpha(P.item, 0.35); ctx.fill()
        ctx.lineWidth = 2; ctx.strokeStyle = P.item; ctx.stroke()
      }
      if (d.level) {
        ctx.lineWidth = 3
        for (let q = 0; q < 4; q++) {
          const a0 = -Math.PI / 2 + q * Math.PI / 2 + 0.16
          ctx.strokeStyle = q < d.level ? color : P.line
          ctx.beginPath(); ctx.arc(b.x, b.y, 13.5, a0, a0 + Math.PI / 2 - 0.32); ctx.stroke()
        }
      }
      ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = `600 10px ${P.mono}`
      ctx.fillText(d.badge, b.x, b.y + 0.5)
    } else {
      const size = 20
      if (selected) {
        roundRect(ctx, b.x - size / 2 - 5, b.y - size / 2 - 5, size + 10, size + 10, 8)
        ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.stroke()
      }
      roundRect(ctx, b.x - size / 2, b.y - size / 2, size, size, 5)
      ctx.fillStyle = d.fill || P.surface; ctx.fill()
      ctx.lineWidth = 2; ctx.strokeStyle = d.fill || color; ctx.stroke()
      ctx.fillStyle = d.fill ? '#ffffff' : color
      ctx.font = `600 11px ${P.mono}`
      ctx.fillText(d.badge, b.x, b.y + 0.5)
      if (d.hasItem) {
        const ix = b.x + size / 2 - 1, iy = b.y - size / 2 + 1
        ctx.fillStyle = P.item; ctx.strokeStyle = P.surface; ctx.lineWidth = 1.5
        ctx.fillRect(ix - 5, iy - 5, 10, 10); ctx.strokeRect(ix - 5, iy - 5, 10, 10)
      }
    }
    if (this.layers.labels || selected) this.label(d.label, b.x + 17, b.y, selected ? P.ink : P.line, selected ? 600 : 500)
  }

  private drawRobots(now: number) {
    const ctx = this.ctx, P = this.palette
    for (const [id, r] of this.robots) {
      if (!r.pose) continue
      const rx = this.sx(r.pose.x), ry = this.sy(r.pose.y)
      const rad = Math.max(8, 0.23 * this.cam.s), hd = -r.pose.yaw
      const selected = id === this.selectedRobot
      if (selected || id === this.trailId) {
        const pulse = this.reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 300)
        ctx.globalAlpha = 0.16 + 0.12 * pulse
        ctx.fillStyle = r.meta.color
        ctx.beginPath(); ctx.arc(rx, ry, rad * (1.7 + 0.3 * pulse), 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
      }
      if (selected) {
        ctx.lineWidth = 2; ctx.strokeStyle = P.ink
        ctx.beginPath(); ctx.arc(rx, ry, rad + 5, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.beginPath(); ctx.arc(rx, ry, rad, 0, Math.PI * 2)
      ctx.fillStyle = r.meta.color; ctx.fill()
      ctx.lineWidth = 2; ctx.strokeStyle = P.surface; ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(rx + Math.cos(hd) * rad * 0.72, ry + Math.sin(hd) * rad * 0.72)
      ctx.lineTo(rx + Math.cos(hd + 2.4) * rad * 0.5, ry + Math.sin(hd + 2.4) * rad * 0.5)
      ctx.lineTo(rx + Math.cos(hd - 2.4) * rad * 0.5, ry + Math.sin(hd - 2.4) * rad * 0.5)
      ctx.closePath()
      ctx.fillStyle = '#ffffff'; ctx.fill()
      if (r.meta.label && (this.layers.labels || selected)) this.label(r.meta.label, rx + rad + 7, ry - rad - 4, r.meta.color, 600)
    }
  }

  private label(text: string, x: number, y: number, border: string, weight: number) {
    const ctx = this.ctx
    ctx.font = `${weight} 11px ${this.palette.font}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(text).width
    roundRect(ctx, x, y - 9, tw + 12, 18, 5)
    ctx.fillStyle = this.palette.surface; ctx.fill()
    ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = this.palette.ink
    ctx.fillText(text, x + 6, y + 0.5)
  }

  private drawScaleBar() {
    const ctx = this.ctx, P = this.palette
    let len = 0.25
    for (const n of [0.25, 0.5, 1, 2, 5, 10, 20, 50]) if (n * this.cam.s <= 130) len = n
    const bw = len * this.cam.s, x0 = 14, y0 = this.ch - 18
    const bar = () => {
      ctx.beginPath(); ctx.moveTo(x0, y0 - 5); ctx.lineTo(x0, y0); ctx.lineTo(x0 + bw, y0); ctx.lineTo(x0 + bw, y0 - 5); ctx.stroke()
    }
    ctx.lineCap = 'butt'
    ctx.lineWidth = 4; ctx.strokeStyle = P.surface; bar()
    ctx.lineWidth = 2; ctx.strokeStyle = P.ink; bar()
    ctx.font = `600 11px ${P.mono}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    const text = len < 1 ? `${len * 100} cm` : `${len} m`
    ctx.lineWidth = 3; ctx.strokeStyle = P.surface; ctx.strokeText(text, x0 + 4, y0 - 4)
    ctx.fillStyle = P.ink; ctx.fillText(text, x0 + 4, y0 - 4)
  }
}

// ------------------------------------------------------------------------------ helpers

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)) }
function mix(a: number, b: number, t: number) { return Math.round(a + (b - a) * t) }
function rgb(c: number[]) { return `rgb(${c[0]}, ${c[1]}, ${c[2]})` }

let probe: CanvasRenderingContext2D | null = null
function toRgb(color: string): number[] {
  probe ??= document.createElement('canvas').getContext('2d')
  if (!probe) return [0, 0, 0]
  probe.fillStyle = '#000'
  probe.fillStyle = color
  const v = String(probe.fillStyle)
  if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]
  const m = v.match(/[\d.]+/g) ?? ['0', '0', '0']
  return [+m[0], +m[1], +m[2]]
}

function withAlpha(color: string, a: number) {
  const [r, g, b] = toRgb(color)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
