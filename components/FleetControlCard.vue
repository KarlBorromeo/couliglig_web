<template>
  <v-card elevation="3">
    <v-card-title class="d-flex align-center flex-wrap ga-2">
      <p class="ml-1">
        <v-icon class="py-0 my-0" color="blue">mdi-robot-industrial</v-icon>
        <span class="ml-1">Fleet</span>
      </p>
      <v-chip v-if="fleet.mode" size="small" variant="tonal" :color="fleet.isBus ? 'primary' : undefined">
        FLEET_MODE={{ fleet.mode }}
      </v-chip>
      <v-spacer />
      <template v-if="fleet.isBus">
        <v-btn-toggle
          :model-value="fleet.control"
          mandatory
          density="comfortable"
          variant="outlined"
          divided
          :disabled="fleet.busy || !fleet.snapshot"
          aria-label="Fleet control"
          @update:model-value="switchControl"
        >
          <v-btn value="manual" prepend-icon="mdi-hand-back-right">Manual</v-btn>
          <v-btn value="auto" prepend-icon="mdi-robot">Auto</v-btn>
        </v-btn-toggle>
        <v-btn
          color="error"
          variant="flat"
          prepend-icon="mdi-alert-octagon"
          :loading="fleet.busy"
          :disabled="!fleet.snapshot"
          @click="estop"
        >
          E-stop
        </v-btn>
      </template>
    </v-card-title>

    <v-card-text>
      <p v-if="fleet.mode === null" class="text-medium-emphasis">Checking the server's fleet mode…</p>
      <p v-else-if="!fleet.isBus" class="text-medium-emphasis">
        The fleet coordinator is off (FLEET_MODE=legacy): each robot runs its own RL loop.
      </p>
      <template v-else>
        <v-alert v-if="fleet.error" type="warning" variant="tonal" density="compact" class="mb-3">
          {{ fleet.error }}. Manual controls stay available.
        </v-alert>
        <p v-else-if="fleet.control === 'manual'" class="text-body-2 mb-3">
          <strong>Manual:</strong> the coordinator gives robots no tasks; move them by hand below.
          Switch to <strong>Auto</strong> to let it run the orders.
        </p>
        <p v-else-if="fleet.control === 'auto'" class="text-body-2 mb-3">
          <strong>Auto:</strong> the coordinator is running the orders; hand docking is off.
          Switching to <strong>Manual</strong> lets running tasks finish and starts no new ones.
        </p>
        <p v-if="anyEstop" class="text-body-2 text-error mb-3">
          E-stopped: robots stay stopped until you switch to Auto.
        </p>

        <v-table density="compact">
          <thead>
            <tr>
              <th v-for="h in robotHeaders" :key="h" class="font-weight-bold" style="color: rgb(105, 105, 105);">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in robots" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.role }}</td>
              <td><v-chip size="x-small" :color="linkColor(r.status)" variant="flat">{{ r.status }}</v-chip></td>
              <td>
                <v-chip size="x-small" :color="stateColor(r.exec_state)" variant="tonal">{{ r.exec_state }}</v-chip>
                <v-icon v-if="r.pose && !r.pose.loc_ok" size="16" color="warning" class="ml-1" title="Not localized">
                  mdi-map-marker-question
                </v-icon>
              </td>
              <td>{{ taskText(r) }}</td>
              <td>{{ r.zone ? `${r.zone}${r.parked ? ' (parked)' : ''}` : '' }}</td>
              <td>{{ [r.held_item, ...r.carried].filter(Boolean).join(', ') }}</td>
            </tr>
            <tr v-if="!robots.length">
              <td :colspan="robotHeaders.length" class="text-medium-emphasis">No robot has joined the fleet yet.</td>
            </tr>
          </tbody>
        </v-table>

        <v-table v-if="items.length" density="compact" class="mt-4">
          <thead>
            <tr>
              <th v-for="h in itemHeaders" :key="h" class="font-weight-bold" style="color: rgb(105, 105, 105);">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in items" :key="it.id">
              <td>{{ it.id }}</td>
              <td>{{ it.status }}</td>
              <td>{{ it.pickup_dock }} → {{ it.receiver_dock }}</td>
              <td>{{ it.weight }}</td>
              <td>{{ it.transporter || it.holder || '' }}</td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </v-card-text>
    <Snackbar ref="snackbar" />
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useFleetStore, type FleetControl, type FleetRobot } from '~/stores/fleetStore'

const fleet = useFleetStore()
const snackbar = ref<any>(null)
const robotHeaders = ['Robot', 'Role', 'Link', 'State', 'Task', 'Waiting zone', 'Load']
const itemHeaders = ['Item', 'Status', 'Pickup → Receiver', 'Weight', 'With']

const robots = computed(() =>
  Object.entries(fleet.snapshot?.robots ?? {})
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })))
const items = computed(() =>
  Object.entries(fleet.snapshot?.items ?? {})
    .filter(([, it]) => it.status !== 'DELIVERED')
    .map(([id, it]) => ({ id, ...it })))
const anyEstop = computed(() => robots.value.some(r => r.exec_state === 'ESTOP'))

function taskText(r: FleetRobot) {
  const t = r.task ? fleet.snapshot?.tasks[r.task] : undefined
  return t ? `${t.kind} → ${t.target} (${t.status})` : ''
}
function linkColor(status: string) {
  return status === 'ONLINE' ? 'success' : status === 'STALE' ? 'warning' : 'error'
}
function stateColor(state: string) {
  if (state === 'ESTOP' || state === 'SAFE_STOP') return 'error'
  if (state === 'HOLD') return 'warning'
  return state === 'EXECUTING' ? 'primary' : undefined
}

async function switchControl(control: FleetControl) {
  if (!control || control === fleet.control) return
  try {
    await fleet.setControl(control)
    snackbar.value?.showSnackbar(
      control === 'auto' ? 'Auto: the coordinator is running the fleet' : 'Manual: no new tasks; running ones finish',
      'success')
  } catch (error: any) {
    snackbar.value?.showSnackbar(error.message, 'error', 6000)
  }
}

async function estop() {
  try {
    await fleet.estop()
    snackbar.value?.showSnackbar('E-stop sent: robots stop, fleet is in manual', 'warning', 6000)
  } catch (error: any) {
    snackbar.value?.showSnackbar(error.message, 'error', 6000)
  }
}

onMounted(() => fleet.startPolling())
onUnmounted(() => fleet.stopPolling())
</script>
