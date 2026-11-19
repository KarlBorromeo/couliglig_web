<template>
  <v-dialog :model-value="modelValue" max-width="1100" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <v-icon color="blue">mdi-console</v-icon>
        <span>Services · {{ robot?.hostname }}</span>
        <span class="text-body-2 text-medium-emphasis">{{ robot?.namespace }} · {{ robot?.ip }}</span>
        <v-spacer />
        <v-chip v-if="unreachable" size="small" color="warning" variant="tonal" prepend-icon="mdi-lan-disconnect">
          Robot API not answering, retrying…
        </v-chip>
        <v-btn icon="mdi-close" variant="text" density="comfortable" aria-label="Close" @click="emit('update:modelValue', false)" />
      </v-card-title>

      <v-tabs v-model="tab" density="comfortable" color="primary">
        <v-tab v-for="s in services" :key="s.name" :value="s.name">
          {{ s.label }}
          <v-chip class="ml-2" size="x-small" :color="stateColor(s.state)" variant="flat">{{ s.state }}</v-chip>
        </v-tab>
      </v-tabs>
      <v-divider />

      <v-card-text v-if="current" class="pt-3">
        <div class="d-flex align-center flex-wrap ga-2 mb-3">
          <span class="text-body-2">
            <code>{{ current.unit }}</code>
            <span class="text-medium-emphasis">
              · {{ current.state }}<template v-if="current.sub_state"> ({{ current.sub_state }})</template>
              <template v-if="current.since"> · since {{ current.since }}</template>
            </span>
          </span>
          <v-spacer />
          <v-btn
            v-if="current.actions.includes('start')"
            color="success" variant="flat" size="small" prepend-icon="mdi-play"
            :disabled="isRunning(current) || acting !== null" :loading="acting === 'start'"
            @click="act('start')"
          >Start</v-btn>
          <v-btn
            v-if="current.actions.includes('stop')"
            color="error" variant="flat" size="small" prepend-icon="mdi-stop"
            :disabled="!isRunning(current) || acting !== null" :loading="acting === 'stop'"
            @click="confirmAction = 'stop'"
          >Stop</v-btn>
          <v-btn
            v-if="current.actions.includes('restart')"
            color="warning" variant="flat" size="small" prepend-icon="mdi-restart"
            :disabled="acting !== null" :loading="acting === 'restart'"
            @click="confirmAction = 'restart'"
          >Restart</v-btn>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-3" closable @click:close="error = ''">
          {{ error }}
        </v-alert>

        <div class="d-flex align-center ga-3 mb-1">
          <span class="text-body-2 font-weight-medium">Log</span>
          <span class="text-caption text-medium-emphasis">{{ lines.length }} lines</span>
          <v-spacer />
          <v-switch v-model="follow" label="Follow" color="primary" density="compact" hide-details inset />
          <v-btn size="small" variant="text" prepend-icon="mdi-eraser" @click="lines = []">Clear</v-btn>
        </div>
        <div ref="logBox" class="log-box" @scroll="onScroll">
          <div v-if="!lines.length" class="log-empty">{{ logsLoading ? 'Loading…' : 'No log lines yet.' }}</div>
          <div v-for="(l, i) in lines" :key="i" :class="['log-line', priorityClass(l.priority)]">
            <span class="log-ts">{{ timeOf(l.ts) }}</span>{{ l.message }}
          </div>
        </div>
      </v-card-text>
      <v-card-text v-else class="text-medium-emphasis">
        {{ unreachable ? 'Cannot reach the robot API.' : 'Loading services…' }}
      </v-card-text>
    </v-card>

    <v-dialog :model-value="confirmAction !== null" max-width="440" @update:model-value="v => { if (!v) confirmAction = null }">
      <v-card>
        <v-card-title class="text-capitalize">{{ confirmAction }} {{ current?.label }}?</v-card-title>
        <v-card-text>{{ confirmText }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmAction = null">Cancel</v-btn>
          <v-btn :color="confirmAction === 'stop' ? 'error' : 'warning'" variant="flat" @click="act(confirmAction!)">
            {{ confirmAction }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type { onlineRobot } from '~/stores/dockStore'

// The robot API's /services: couliglig-api ("api", restart only) and couliglig-control
// ("main", couliglig-main's bringup: start / stop / restart), with their journal logs.
interface RobotService {
  name: string
  label: string
  unit: string
  actions: string[]
  state: string          // active | inactive | failed | activating | deactivating
  sub_state: string
  pid: number
  since: string | null
}
interface LogLine { ts: string | null; priority: number; message: string }

const props = defineProps<{ modelValue: boolean; robot: onlineRobot | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const POLL_MS = 2000
const TAIL = 300
const KEEP = 3000

const services = ref<RobotService[]>([])
const tab = ref<string>('main')
const lines = ref<LogLine[]>([])
const cursor = ref<string | null>(null)
const follow = ref(true)
const error = ref('')
const unreachable = ref(false)
const logsLoading = ref(false)
const acting = ref<string | null>(null)
const confirmAction = ref<string | null>(null)
const logBox = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let generation = 0          // bumps on open / tab change, so late answers are dropped

const current = computed(() => services.value.find(s => s.name === tab.value))
const confirmText = computed(() => {
  if (confirmAction.value === 'stop') return 'The robot stack stops: navigation, docking and the fleet agent end until you start it again.'
  if (current.value?.name === 'api') return 'The robot API restarts; this robot drops off the list for a few seconds.'
  return 'The robot stack restarts: whatever the robot is doing now ends.'
})

function base() {
  return `http://${props.robot?.ip}:8000/services`
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.detail || `${res.status} ${res.statusText}`), { status: res.status })
  return body
}

async function poll(gen: number) {
  if (!props.robot) return
  try {
    const body = await getJson(base())
    if (gen !== generation) return
    services.value = body.services
    unreachable.value = false
    if (!services.value.some(s => s.name === tab.value) && services.value.length) tab.value = services.value[0].name
    await pollLogs(gen)
  } catch (e: any) {
    if (gen !== generation) return
    if (e.status) error.value = e.message
    else unreachable.value = true          // network error: the API is restarting or the robot is off
  }
}

async function pollLogs(gen: number) {
  const name = tab.value
  const params = new URLSearchParams(cursor.value ? { after: cursor.value } : { lines: String(TAIL) })
  logsLoading.value = !cursor.value
  try {
    const body = await getJson(`${base()}/${name}/logs?${params}`)
    if (gen !== generation || name !== tab.value) return
    cursor.value = body.cursor
    if (body.lines.length) {
      lines.value = lines.value.concat(body.lines).slice(-KEEP)
      if (follow.value) scrollToBottom()
    }
  } catch (e: any) {
    if (gen === generation && e.status) error.value = e.message
    else throw e
  } finally {
    logsLoading.value = false
  }
}

function schedule(gen: number) {
  timer = setTimeout(async () => {
    await poll(gen)
    if (gen === generation && props.modelValue) schedule(gen)
  }, POLL_MS)
}

async function restart() {
  stop()
  const gen = ++generation
  lines.value = []
  cursor.value = null
  error.value = ''
  follow.value = true
  await poll(gen)
  scrollToBottom()
  if (gen === generation && props.modelValue) schedule(gen)
}

function stop() {
  generation++
  if (timer) clearTimeout(timer)
  timer = null
}

async function act(action: string) {
  confirmAction.value = null
  const s = current.value
  if (!s) return
  acting.value = action
  error.value = ''
  try {
    await getJson(`${base()}/${s.name}/${action}`, { method: 'POST' })
  } catch (e: any) {
    if (e.status) error.value = e.message
    // a restart of the API itself may cut the answer short: polling shows what happened
    else if (!(s.name === 'api' && action === 'restart')) error.value = e.message
  } finally {
    acting.value = null
  }
}

function isRunning(s: RobotService) {
  return s.state === 'active' || s.state === 'activating' || s.state === 'reloading'
}
function stateColor(state: string) {
  if (state === 'active') return 'success'
  if (state === 'failed') return 'error'
  if (state === 'activating' || state === 'deactivating' || state === 'reloading') return 'warning'
  return 'grey'
}
function priorityClass(p: number) {
  return p <= 3 ? 'log-error' : p === 4 ? 'log-warn' : ''
}
function timeOf(ts: string | null) {
  return ts ? new Date(ts).toLocaleTimeString() + ' ' : ''
}

function isAtBottom() {
  const el = logBox.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 40
}
function scrollToBottom() {
  nextTick(() => {
    const el = logBox.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
function onScroll() {
  // scrolling up to read pauses following; back at the bottom resumes it
  follow.value = isAtBottom()
}
watch(follow, f => { if (f) scrollToBottom() })

watch(() => [props.modelValue, props.robot?.ip], ([open]) => {
  if (open && props.robot) {
    services.value = []
    unreachable.value = false
    restart()
  } else {
    stop()
  }
}, { immediate: true })
watch(tab, (now, before) => { if (props.modelValue && before !== undefined && now !== before) restart() })
onUnmounted(stop)
</script>

<style scoped>
.log-box {
  height: 55vh;
  overflow-y: auto;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  padding: 8px 10px;
  border-radius: 4px;
}
.log-line { white-space: pre-wrap; word-break: break-word; }
.log-ts { color: #808080; }
.log-error { color: #f48771; }
.log-warn { color: #e5c07b; }
.log-empty { color: #808080; }
</style>
