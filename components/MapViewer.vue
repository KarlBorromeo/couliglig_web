<template>
  <div ref="root" class="map-viewer" :style="{ height }">
    <canvas ref="canvas" />

    <div v-if="!hasGrid" class="mv-empty">
      <slot name="empty">{{ emptyText }}</slot>
    </div>

    <div v-if="$slots.status && hasGrid" class="mv-chip mv-status">
      <slot name="status" :stats="stats" />
    </div>
    <div v-if="$slots.legend && hasGrid" class="mv-chip mv-legend">
      <slot name="legend" />
    </div>
    <div v-if="cursor" class="mv-chip mv-coords">
      x {{ cursor.x.toFixed(2) }} · y {{ cursor.y.toFixed(2) }} m
    </div>

    <div v-if="hasGrid" class="mv-tools">
      <button type="button" title="Zoom in" aria-label="Zoom in" @click="renderer?.zoomBy(1.4)">
        <v-icon size="18">mdi-plus</v-icon>
      </button>
      <button type="button" title="Zoom out" aria-label="Zoom out" @click="renderer?.zoomBy(1 / 1.4)">
        <v-icon size="18">mdi-minus</v-icon>
      </button>
      <button type="button" title="Fit map" aria-label="Fit map" :aria-pressed="mode === 'fit'" @click="renderer?.setMode('fit')">
        <v-icon size="18">mdi-fit-to-screen-outline</v-icon>
      </button>
      <button
        type="button"
        title="Follow robot"
        aria-label="Follow robot"
        :aria-pressed="mode === 'follow'"
        :disabled="!followRobotId"
        @click="renderer?.setMode(mode === 'follow' ? 'fit' : 'follow')"
      >
        <v-icon size="18">mdi-crosshairs-gps</v-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Map canvas shared by the Mapping and Navigation pages.
// Low-frequency state (docks, selection, layers) comes in as props; streaming data from ROS
// (grid, costmaps, robot poses, paths) is pushed through the exposed methods so big arrays and
// 10 Hz TF never go through Vue reactivity.
import {
  MapRenderer,
  type CameraMode,
  type CostmapKind,
  type MapDockMarker,
  type MapGrid,
  type MapLayers,
  type RobotMeta
} from '~/utils/mapRenderer'
import type { Pose2D } from '~/utils/dockMarkers'

const props = withDefaults(defineProps<{
  height?: string
  emptyText?: string
  docks?: MapDockMarker[]
  robots?: RobotMeta[]
  selectedRobotId?: string | null
  selectedDockId?: string | null
  /** robot the follow button centres on */
  followRobotId?: string | null
  /** robot that leaves a 40 s trail */
  trailRobotId?: string | null
  layers?: Partial<MapLayers>
  /** px kept free above the fitted map for the status chip */
  fitPadTop?: number
}>(), {
  height: '600px',
  emptyText: 'Waiting for the map…',
  docks: () => [],
  robots: () => [],
  selectedRobotId: null,
  selectedDockId: null,
  followRobotId: null,
  trailRobotId: null,
  layers: () => ({}),
  fitPadTop: 64
})

const emit = defineEmits<{
  (e: 'select-robot', id: string): void
  (e: 'select-dock', id: string): void
}>()

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const hasGrid = ref(false)
const mode = ref<CameraMode>('fit')
const cursor = ref<{ x: number; y: number } | null>(null)
const stats = ref({ freeArea: 0, width: 0, height: 0, resolution: 0 })
let renderer: MapRenderer | null = null

onMounted(() => {
  if (!root.value || !canvas.value) return
  renderer = new MapRenderer(root.value, canvas.value, {
    onSelectRobot: id => emit('select-robot', id),
    onSelectDock: id => emit('select-dock', id),
    onCursor: (p) => { cursor.value = p },
    onModeChange: (m) => { mode.value = m }
  })
  renderer.setFitPadTop(props.fitPadTop)
  renderer.setRobotMeta(props.robots)
  renderer.setDocks(props.docks)
  renderer.setSelection(props.selectedRobotId, props.selectedDockId)
  renderer.setLayers(props.layers)
  renderer.setFollowTarget(props.followRobotId)
  renderer.setTrailRobot(props.trailRobotId)
})

onBeforeUnmount(() => {
  renderer?.destroy()
  renderer = null
})

watch(() => props.robots, r => renderer?.setRobotMeta(r), { deep: true })
watch(() => props.docks, d => renderer?.setDocks(d), { deep: true })
watch(() => [props.selectedRobotId, props.selectedDockId] as const, ([r, d]) => renderer?.setSelection(r, d))
watch(() => props.layers, l => renderer?.setLayers(l), { deep: true })
watch(() => props.followRobotId, (id) => {
  renderer?.setFollowTarget(id)
  if (!id && mode.value === 'follow') renderer?.setMode('fit')
})
watch(() => props.trailRobotId, id => renderer?.setTrailRobot(id))
watch(() => props.fitPadTop, px => renderer?.setFitPadTop(px))

function setGrid(grid: MapGrid | null) {
  renderer?.setGrid(grid)
  hasGrid.value = !!grid
  if (!grid) { stats.value = { freeArea: 0, width: 0, height: 0, resolution: 0 }; return }
  let free = 0
  const data = grid.data
  for (let i = 0; i < data.length; i++) if (data[i] >= 0 && data[i] <= 25) free++
  stats.value = { freeArea: free * grid.resolution * grid.resolution, width: grid.width, height: grid.height, resolution: grid.resolution }
}

defineExpose({
  setGrid,
  setCostmap: (kind: CostmapKind, grid: MapGrid | null) => renderer?.setCostmap(kind, grid),
  setRobotPose: (id: string, pose: Pose2D) => renderer?.setRobotPose(id, pose),
  setPath: (id: string, points: [number, number][] | null) => renderer?.setPath(id, points),
  clearTrail: () => renderer?.clearTrail(),
  clear: () => {
    renderer?.clear()
    renderer?.setRobotMeta(props.robots)
    renderer?.setDocks(props.docks)
    hasGrid.value = false
  }
})
</script>

<style scoped>
.map-viewer {
  /* map palette, read by utils/mapRenderer.ts */
  --mv-unknown: #e3e8ee;
  --mv-free: #fbfcfd;
  --mv-wall: #1e2a36;
  --mv-grid: rgba(30, 42, 54, 0.08);
  --mv-ink: #16202b;
  --mv-surface: #ffffff;
  --mv-muted: #8a96a3;
  --mv-line: #d6dce3;
  --mv-accent: #e8590c;
  --mv-dock: #1c6fd1;
  --mv-cost: #6741d9;
  --mv-local: #e67700;
  --mv-item: #f59f00;
  --mv-mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;

  position: relative;
  min-height: 360px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--mv-line);
  background: var(--mv-unknown);
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.map-viewer.mv-dragging { cursor: grabbing; }
.v-theme--dark .map-viewer {
  --mv-unknown: #10151b;
  --mv-free: #212a34;
  --mv-wall: #d3dce6;
  --mv-grid: rgba(211, 220, 230, 0.07);
  --mv-ink: #e5eaf0;
  --mv-surface: #151a21;
  --mv-muted: #93a0ae;
  --mv-line: #29313b;
  --mv-accent: #ff7a2f;
  --mv-dock: #5aa2ff;
  --mv-cost: #9775fa;
  --mv-local: #ffa94d;
  --mv-item: #fcc419;
}
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

.mv-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--mv-muted);
  font-size: 15px;
  pointer-events: none;
}

.mv-chip {
  position: absolute;
  background: color-mix(in srgb, var(--mv-surface) 92%, transparent);
  color: var(--mv-ink);
  border: 1px solid var(--mv-line);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.35;
  backdrop-filter: blur(6px);
  cursor: default;
}
.mv-status { top: 10px; left: 10px; max-width: 60%; }
.mv-legend { top: 10px; right: 10px; max-width: 45%; }
.mv-coords { bottom: 10px; left: 110px; font-family: var(--mv-mono); font-variant-numeric: tabular-nums; }

.mv-tools { position: absolute; right: 10px; bottom: 10px; display: flex; flex-direction: column; gap: 6px; }
.mv-tools button {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--mv-line);
  background: color-mix(in srgb, var(--mv-surface) 92%, transparent);
  color: var(--mv-ink);
  display: grid;
  place-items: center;
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.mv-tools button[aria-pressed="true"] { background: var(--mv-ink); color: var(--mv-surface); border-color: var(--mv-ink); }
.mv-tools button:disabled { opacity: 0.4; cursor: not-allowed; }
.mv-tools button:focus-visible { outline: 2px solid var(--mv-accent); outline-offset: 2px; }

@media (max-width: 600px) {
  .mv-legend { display: none; }
  .mv-status { max-width: calc(100% - 20px); }
}
</style>
