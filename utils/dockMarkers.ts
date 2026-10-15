// Helpers for the Mapping page: detected-dock types, operator draft helpers,
// the createjs/ROS2D dock-marker layer and 2D pose math for the robot arrow.

export const DOCK_TYPES = ['pickup', 'receiver', 'waiting_zone', 'hand_off'] as const
export type DockType = typeof DOCK_TYPES[number]

/** One entry of custom_msgs/msg/DetectedDockArray.docks */
export interface DetectedDock {
  aruco_id: number
  x: number
  y: number
  theta: number
  marker_yaw: number
  observations: number
  position_std: number
  last_seen?: { sec: number; nanosec: number }
}

/** Operator draft for one detected ArUco id */
export interface DockEdit {
  dock_id: string
  dock_type: DockType | null
  ignored: boolean
}
export type DockEdits = Record<number, DockEdit>

/** A currently detected dock merged with its draft, as shown in the finish dialog. */
export interface FinishMappingDock extends DockEdit {
  aruco_id: number
}

/** position_std (m) above which a detection is flagged as not settled */
export const DOCK_STD_WARN = 0.04

/** Next free `dock_N` name (N starts at 0, continues after the highest used). */
export function nextDockId(edits: DockEdits): string {
  let max = -1
  Object.values(edits).forEach((edit) => {
    const match = edit.dock_id.trim().match(/^dock_?(\d+)$/i)
    if (!match) return
    const n = Number.parseInt(match[1], 10)
    if (!Number.isNaN(n)) max = Math.max(max, n)
  })
  return `dock_${max + 1}`
}

/** Settledness 1..4 from observation count and position spread. */
export function dockFixLevel(dock: DetectedDock): number {
  const obs = dock.observations
  const obsLevel = obs >= 30 ? 4 : obs >= 15 ? 3 : obs >= 5 ? 2 : 1
  const std = dock.position_std
  const stdLevel = std <= 0.01 ? 4 : std <= 0.02 ? 3 : std <= DOCK_STD_WARN ? 2 : 1
  return Math.min(obsLevel, stdLevel)
}

/** Parse/sanitize a draft read from localStorage. */
export function sanitizeDockEdits(raw: unknown): DockEdits {
  const out: DockEdits = {}
  if (!raw || typeof raw !== 'object') return out
  Object.entries(raw as Record<string, any>).forEach(([key, value]) => {
    const id = Number(key)
    if (!Number.isInteger(id) || !value || typeof value !== 'object') return
    out[id] = {
      dock_id: typeof value.dock_id === 'string' ? value.dock_id : '',
      dock_type: DOCK_TYPES.includes(value.dock_type) ? value.dock_type : null,
      ignored: value.ignored === true
    }
  })
  return out
}

// ---------------------------------------------------------------------------
// 2D pose helpers (robot arrow = map->odom composed with odom->base_footprint)
// ---------------------------------------------------------------------------

export interface Pose2D { x: number; y: number; yaw: number }

export function tfToPose2D(t: any): Pose2D {
  const p = t.transform.translation
  const q = t.transform.rotation
  const yaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))
  return { x: p.x, y: p.y, yaw }
}

/** a ∘ b : pose b expressed in a's parent frame. */
export function composePose2D(a: Pose2D, b: Pose2D): Pose2D {
  const c = Math.cos(a.yaw)
  const s = Math.sin(a.yaw)
  return {
    x: a.x + c * b.x - s * b.y,
    y: a.y + s * b.x + c * b.y,
    yaw: a.yaw + b.yaw
  }
}

/** Strip a leading '/' and any namespace prefix: '/bot_1/odom' -> 'odom'. */
export function bareFrame(frame: string | undefined): string {
  if (!frame) return ''
  const parts = frame.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

// ---------------------------------------------------------------------------
// Dock marker layer (createjs container added to the ROS2D viewer scene)
// ---------------------------------------------------------------------------

interface MarkerEntry {
  container: any
  arrow: any
  label: any
  styleKey: string
}

const LABEL_FONT_PX = 13
const ARROW_SIZE = 0.4
const ARROW_SIZE_SELECTED = 0.55

export class DockMarkerLayer {
  readonly container: any
  private markers = new Map<number, MarkerEntry>()
  private createjs: any
  private ROS2D: any
  private onSelect: (arucoId: number) => void

  constructor(onSelect: (arucoId: number) => void) {
    this.createjs = (window as any).createjs
    this.ROS2D = (window as any).ROS2D
    this.onSelect = onSelect
    this.container = new this.createjs.Container()
  }

  /** Update markers in place from the latest snapshot. sceneScale = viewer px per meter. */
  sync(docks: DetectedDock[], edits: DockEdits, selectedId: number | null, sceneScale?: number) {
    const createjs = this.createjs
    const pxToMeters = sceneScale && sceneScale > 0 ? 1 / sceneScale : 0.015
    const seen = new Set<number>()

    docks.forEach((dock) => {
      seen.add(dock.aruco_id)
      const edit = edits[dock.aruco_id]
      const skipped = edit?.ignored === true
      const selected = selectedId === dock.aruco_id

      let entry = this.markers.get(dock.aruco_id)
      if (!entry) {
        const container = new createjs.Container()
        const hit = new createjs.Shape()
        hit.graphics.beginFill('#000').drawCircle(0, 0, 0.4)
        container.hitArea = hit
        container.cursor = 'pointer'
        const id = dock.aruco_id
        container.on('click', () => this.onSelect(id))

        const label = new createjs.Text('', `bold ${LABEL_FONT_PX}px sans-serif`, '#1565c0')
        label.textBaseline = 'bottom'
        container.addChild(label)

        entry = { container, arrow: null, label, styleKey: '' }
        this.markers.set(dock.aruco_id, entry)
        this.container.addChild(container)
      }

      // Arrow graphics are baked at construction, so rebuild only when the style changes.
      const styleKey = `${skipped}|${selected}`
      if (entry.styleKey !== styleKey) {
        if (entry.arrow) entry.container.removeChild(entry.arrow)
        const color = selected
          ? createjs.Graphics.getRGB(255, 193, 7)
          : skipped
            ? createjs.Graphics.getRGB(158, 158, 158)
            : createjs.Graphics.getRGB(25, 118, 210)
        entry.arrow = new this.ROS2D.ArrowShape({
          size: selected ? ARROW_SIZE_SELECTED : ARROW_SIZE,
          strokeSize: selected ? 0.07 : 0.04,
          strokeColor: color,
          fillColor: color
        })
        entry.container.addChildAt(entry.arrow, 0)
        entry.label.color = selected ? '#b28704' : skipped ? '#9e9e9e' : '#1565c0'
        entry.styleKey = styleKey
      }

      entry.container.x = dock.x
      entry.container.y = -dock.y
      entry.arrow.rotation = -dock.theta * 180 / Math.PI

      // Label stays unrotated and is scaled so it renders at ~LABEL_FONT_PX on screen.
      entry.label.text = `${edit?.dock_id || 'dock'} (${dock.aruco_id})`
      entry.label.scaleX = entry.label.scaleY = pxToMeters
      entry.label.x = 6 * pxToMeters
      entry.label.y = -6 * pxToMeters

      if (selected) this.container.setChildIndex(entry.container, this.container.numChildren - 1)
    })

    // Drop markers whose ids disappeared from the snapshot.
    for (const [id, entry] of this.markers.entries()) {
      if (!seen.has(id)) {
        entry.container.removeAllEventListeners()
        this.container.removeChild(entry.container)
        this.markers.delete(id)
      }
    }
  }

  clear() {
    this.markers.forEach((entry) => {
      entry.container.removeAllEventListeners()
    })
    this.markers.clear()
    this.container.removeAllChildren()
  }

  destroy() {
    this.clear()
    this.container.parent?.removeChild(this.container)
  }
}
