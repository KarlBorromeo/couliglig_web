<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="success" class="mr-2">mdi-check</v-icon>
        Finish Mapping
      </v-card-title>
      <v-card-subtitle>Saves the map and docks, then stops SLAM.</v-card-subtitle>

      <v-card-text>
        <v-text-field
          v-model="name"
          label="Config name *"
          variant="outlined"
          density="compact"
          :error-messages="name.trim() ? [] : ['Required']"
        />
        <v-text-field
          v-model="description"
          label="Description"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-4"
        />

        <p class="font-weight-bold">Docks to save ({{ toSave.length }})</p>
        <v-list v-if="toSave.length" density="compact" class="py-0">
          <v-list-item v-for="dock in toSave" :key="dock.aruco_id" class="px-0" min-height="28">
            <span class="font-weight-medium">{{ dock.dock_id || '(no name)' }}</span>
            <span class="text-medium-emphasis"> · ArUco {{ dock.aruco_id }} · </span>
            <span :class="dock.dock_type ? '' : 'text-error'">{{ dock.dock_type ?? 'no type' }}</span>
          </v-list-item>
        </v-list>
        <p v-else class="text-caption text-medium-emphasis">No docks will be saved — only the map.</p>

        <p class="font-weight-bold mt-3">Skipped ({{ skipped.length }})</p>
        <p v-if="skipped.length" class="text-caption text-medium-emphasis">
          {{ skipped.map(d => `ArUco ${d.aruco_id}`).join(', ') }}
        </p>

        <v-alert
          v-if="warnings.length"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          <div v-for="(w, i) in warnings" :key="i">{{ w }}</div>
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text="Cancel" @click="emit('update:modelValue', false)"></v-btn>
        <v-btn
          color="success"
          variant="flat"
          prepend-icon="mdi-content-save"
          :disabled="!isValid"
          @click="submit"
        >
          Save &amp; Stop Slam
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { FinishMappingDock } from '~/utils/dockMarkers'

const props = defineProps<{
  modelValue: boolean
  docks: FinishMappingDock[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', value: { name: string; description: string }): void
}>()

// Kept across open/close so a failed save does not lose what was typed.
const name = ref('')
const description = ref('')

const toSave = computed(() => props.docks.filter(d => !d.ignored))
const skipped = computed(() => props.docks.filter(d => d.ignored))

const warnings = computed(() => {
  const out: string[] = []
  const byName = new Map<string, number[]>()
  toSave.value.forEach((dock) => {
    const dockName = dock.dock_id.trim()
    if (!dockName) out.push(`ArUco ${dock.aruco_id} has no name`)
    else byName.set(dockName, [...(byName.get(dockName) ?? []), dock.aruco_id])
    if (!dock.dock_type) out.push(`${dockName || `ArUco ${dock.aruco_id}`} (ArUco ${dock.aruco_id}) has no type`)
  })
  byName.forEach((ids, dockName) => {
    if (ids.length > 1) out.push(`Duplicate name "${dockName}": ArUco ${ids.join(', ')}`)
  })
  return out
})

const isValid = computed(() => name.value.trim().length > 0 && warnings.value.length === 0)

function submit() {
  if (!isValid.value) return
  emit('submit', { name: name.value.trim(), description: description.value.trim() })
}

function reset() {
  name.value = ''
  description.value = ''
}

defineExpose({ reset })
</script>
