<template>
  <v-card elevation="3" class="d-flex flex-column" style="max-height: 780px;">
    <v-card-title class="d-flex align-center">
      <v-icon size="20" color="blue">mdi-anchor</v-icon>
      <span class="ml-1">Detected Docks ({{ docks.length }})</span>
    </v-card-title>

    <v-card-text v-if="docks.length === 0" class="text-medium-emphasis">
      <template v-if="mapping">No docks detected yet — drive the camera past dock markers.</template>
      <template v-else>Docks are detected while SLAM is running.</template>
    </v-card-text>

    <div v-else ref="scrollBox" style="overflow-y: auto;">
      <v-table density="compact" class="docks-table">
        <thead>
          <tr>
            <th class="font-weight-bold" style="color: rgb(105, 105, 105);">ArUco</th>
            <th class="font-weight-bold" style="color: rgb(105, 105, 105);">Name</th>
            <th class="font-weight-bold" style="color: rgb(105, 105, 105);">Type</th>
            <th class="font-weight-bold" style="color: rgb(105, 105, 105);">Fix</th>
            <th class="font-weight-bold" style="color: rgb(105, 105, 105);">Skip</th>
          </tr>
        </thead>
        <tbody v-for="dock in docks" :key="dock.aruco_id">
          <tr
            :id="`dock-row-${dock.aruco_id}`"
            :class="rowClass(dock.aruco_id)"
            class="dock-row-main"
            @click="emit('select', dock.aruco_id)"
          >
            <td class="font-weight-bold">{{ dock.aruco_id }}</td>
            <td style="min-width: 120px;">
              <v-text-field
                :model-value="edits[dock.aruco_id]?.dock_id ?? ''"
                density="compact"
                variant="underlined"
                hide-details
                :error="isNameInvalid(dock.aruco_id)"
                :disabled="isSkipped(dock.aruco_id)"
                @update:model-value="(v: string) => emit('update', dock.aruco_id, { dock_id: v })"
              />
            </td>
            <td style="min-width: 140px;">
              <v-select
                :model-value="edits[dock.aruco_id]?.dock_type ?? null"
                :items="dockTypes"
                placeholder="— choose —"
                persistent-placeholder
                density="compact"
                variant="underlined"
                hide-details
                :disabled="isSkipped(dock.aruco_id)"
                @update:model-value="(v: DockType | null) => emit('update', dock.aruco_id, { dock_type: v })"
              />
            </td>
            <td>
              <span class="d-inline-flex align-center" :title="fixTitle(dock)">
                <v-icon
                  v-for="n in 4"
                  :key="n"
                  size="x-small"
                  :color="n <= dockFixLevel(dock) ? fixColor(dock) : 'grey-lighten-1'"
                >{{ n <= dockFixLevel(dock) ? 'mdi-circle' : 'mdi-circle-outline' }}</v-icon>
                <v-icon v-if="dock.position_std > DOCK_STD_WARN" size="small" color="orange" class="ml-1">mdi-alert</v-icon>
              </span>
            </td>
            <td>
              <v-checkbox-btn
                :model-value="isSkipped(dock.aruco_id)"
                density="compact"
                @update:model-value="(v: boolean) => emit('update', dock.aruco_id, { ignored: v })"
                @click.stop
              />
            </td>
          </tr>
          <tr :class="rowClass(dock.aruco_id)" class="dock-row-sub" @click="emit('select', dock.aruco_id)">
            <td></td>
            <td colspan="4" class="text-caption text-medium-emphasis">
              x {{ dock.x.toFixed(2) }} &nbsp;y {{ dock.y.toFixed(2) }} &nbsp;θ {{ dock.theta.toFixed(2) }}
              &nbsp;±{{ (dock.position_std * 100).toFixed(0) }}cm &nbsp;· {{ dock.observations }} obs
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { DOCK_TYPES, DOCK_STD_WARN, dockFixLevel, type DetectedDock, type DockEdit, type DockEdits, type DockType } from '~/utils/dockMarkers'

const props = defineProps<{
  docks: DetectedDock[]
  edits: DockEdits
  selectedId: number | null
  mapping: boolean
}>()

const emit = defineEmits<{
  (e: 'update', arucoId: number, patch: Partial<DockEdit>): void
  (e: 'select', arucoId: number): void
}>()

const dockTypes = [...DOCK_TYPES]
const scrollBox = ref<HTMLElement | null>(null)

function isSkipped(id: number) {
  return props.edits[id]?.ignored === true
}

// Names that are empty or used by more than one non-skipped, currently detected dock.
const invalidNameIds = computed(() => {
  const byName = new Map<string, number[]>()
  const bad = new Set<number>()
  props.docks.forEach((dock) => {
    const edit = props.edits[dock.aruco_id]
    if (!edit || edit.ignored) return
    const name = edit.dock_id.trim()
    if (!name) {
      bad.add(dock.aruco_id)
      return
    }
    byName.set(name, [...(byName.get(name) ?? []), dock.aruco_id])
  })
  byName.forEach((ids) => {
    if (ids.length > 1) ids.forEach(id => bad.add(id))
  })
  return bad
})

function isNameInvalid(id: number) {
  return invalidNameIds.value.has(id)
}

function rowClass(id: number) {
  return {
    'dock-row-selected': props.selectedId === id,
    'dock-row-skipped': isSkipped(id)
  }
}

function fixColor(dock: DetectedDock) {
  const level = dockFixLevel(dock)
  return level >= 4 ? 'green' : level >= 2 ? 'amber-darken-2' : 'red'
}

function fixTitle(dock: DetectedDock) {
  const warn = dock.position_std > DOCK_STD_WARN ? ' — position not settled yet' : ''
  return `${dock.observations} observations, ±${(dock.position_std * 100).toFixed(1)} cm${warn}`
}

// Selecting from the map scrolls the matching row into view.
watch(() => props.selectedId, async (id) => {
  if (id === null) return
  await nextTick()
  const row = scrollBox.value?.querySelector(`#dock-row-${id}`)
  row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})
</script>

<style scoped>
.docks-table tr {
  cursor: pointer;
}
.docks-table .dock-row-main td {
  border-bottom: none !important;
}
.docks-table .dock-row-sub td {
  height: auto !important;
  padding-bottom: 6px !important;
}
.docks-table .dock-row-selected td {
  background-color: rgba(255, 193, 7, 0.15);
}
.docks-table .dock-row-skipped td {
  opacity: 0.5;
}
</style>
