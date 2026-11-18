// Helpers for the Mapping page: detected-dock types, operator draft helpers
// and 2D pose math for robot markers (drawing lives in mapRenderer.ts).

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
