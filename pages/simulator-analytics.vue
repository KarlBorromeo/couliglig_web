<template>
  <v-container class="d-flex flex-column ga-5">
    <!-- Live run -->
    <v-card elevation="3">
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <p class="ml-1">
          <v-icon class="py-0 my-0" color="blue">mdi-pulse</v-icon>
          <span class="ml-1">Current run</span>
        </p>
        <v-chip v-if="running" color="green" size="small" variant="flat" class="ml-2">Running</v-chip>
        <v-chip v-else size="small" variant="tonal" class="ml-2">Not running</v-chip>
        <v-spacer></v-spacer>
        <v-btn variant="flat" prepend-icon="mdi-play-box-outline" to="/simulator">Open simulator</v-btn>
      </v-card-title>
      <v-card-text v-if="live && running">
        <div class="text-body-2 mb-3">
          <strong>{{ live.mode }}</strong> on <strong>{{ live.layout || 'demo scene' }}</strong>
          · {{ live.pickers }} pickers · {{ live.transporters }} transporters
          · {{ live.episode_mode && live.episode >= 0 ? `Episode ${live.episode + 1}` : 'Continuous' }}
          · speed {{ live.speed }}×
        </div>
        <v-row dense>
          <v-col v-for="tile in liveTiles" :key="tile.label" cols="6" sm="4" md="3" lg="2">
            <div class="tile">
              <div class="tile-label">{{ tile.label }}</div>
              <div class="tile-value">{{ tile.value }}</div>
              <div v-if="tile.sub" class="tile-sub">{{ tile.sub }}</div>
            </div>
          </v-col>
        </v-row>
        <v-progress-linear
          v-if="live.boxes > 0"
          :model-value="(100 * live.delivered) / live.boxes"
          color="blue"
          height="6"
          rounded
          class="mt-3"
        />
      </v-card-text>
      <v-card-text v-else class="text-medium-emphasis">
        Start a layout in the simulator and its numbers show here as it runs. Finished episodes
        (turn on Episodes in the simulator's Metrics panel) are collected below.
      </v-card-text>
    </v-card>

    <!-- Comparison -->
    <v-card elevation="3">
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <p class="ml-1">
          <v-icon class="py-0 my-0" color="blue">mdi-chart-bar</v-icon>
          <span class="ml-1">Fleet modes compared</span>
        </p>
        <v-spacer></v-spacer>
        <v-select
          v-if="sim.layouts.length"
          v-model="layout"
          :items="sim.layouts"
          label="Layout"
          density="compact"
          hide-details
          style="max-width: 240px"
        />
      </v-card-title>
      <v-card-text v-if="!summary.length" class="text-medium-emphasis">
        No finished episodes yet.
      </v-card-text>
      <v-card-text v-else>
        <div class="text-caption text-medium-emphasis mb-2">
          Mean episode time (lower is better), ± one standard deviation. Episodes only compare
          within a layout.
        </div>
        <svg :viewBox="`0 0 ${chart.width} ${chart.height}`" class="chart" role="img"
             aria-label="Mean episode time per fleet mode">
          <g v-for="(bar, i) in chart.bars" :key="bar.policy">
            <text :x="chart.labelWidth - 8" :y="bar.y + chart.barHeight / 2" text-anchor="end"
                  dominant-baseline="middle" class="chart-label">{{ policyName(bar.policy) }}</text>
            <rect :x="chart.labelWidth" :y="bar.y" :width="bar.w" :height="chart.barHeight"
                  :fill="policyColor(bar.policy)" rx="3" />
            <line v-if="bar.sdW > 0" :x1="chart.labelWidth + bar.w - bar.sdW" :x2="chart.labelWidth + bar.w + bar.sdW"
                  :y1="bar.y + chart.barHeight / 2" :y2="bar.y + chart.barHeight / 2" class="chart-whisker" />
            <text :x="chart.labelWidth + bar.w + bar.sdW + 6" :y="bar.y + chart.barHeight / 2"
                  dominant-baseline="middle" class="chart-value">
              {{ clock(bar.mean) }} · n={{ bar.n }}
            </text>
          </g>
        </svg>

        <v-table density="compact" class="mt-4">
          <thead>
            <tr>
              <th>Mode</th>
              <th class="text-right">Episodes</th>
              <th class="text-right">All delivered</th>
              <th class="text-right">Completion</th>
              <th class="text-right">Mean time</th>
              <th class="text-right">Box time</th>
              <th class="text-right">Picker idle</th>
              <th class="text-right">Transporter idle</th>
              <th class="text-right">Failed dockings</th>
              <th class="text-right">Reward</th>
              <th class="text-right">Policy</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in summary" :key="s.policy">
              <td class="text-no-wrap">
                <span class="dot" :style="{ background: policyColor(s.policy) }"></span>
                {{ policyName(s.policy) }}
              </td>
              <td class="text-right">{{ s.n }}</td>
              <td class="text-right">{{ pct(s.allDelivered) }}</td>
              <td class="text-right">{{ pct(s.completion) }}</td>
              <td class="text-right">{{ clock(s.timeMean) }}<span v-if="s.n > 1" class="text-medium-emphasis"> ± {{ s.timeSd.toFixed(0) }} s</span></td>
              <td class="text-right">{{ s.boxTime.toFixed(0) }} s</td>
              <td class="text-right">{{ pct(s.pickerIdle) }}</td>
              <td class="text-right">{{ pct(s.transporterIdle) }}</td>
              <td class="text-right">{{ s.failedDockings.toFixed(1) }}</td>
              <td class="text-right">{{ s.reward.toFixed(3) }}</td>
              <td class="text-right">{{ s.policyMs > 0 ? `${s.policyMs.toFixed(0)} ms` : '–' }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

    <!-- Episodes -->
    <v-card elevation="3">
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <p class="ml-1">
          <v-icon class="py-0 my-0" color="blue">mdi-format-list-numbered</v-icon>
          <span class="ml-1">Episodes</span>
          <span class="text-medium-emphasis text-body-2 ml-2">{{ sim.episodes.length }} stored in this browser</span>
        </p>
        <v-spacer></v-spacer>
        <v-btn variant="flat" prepend-icon="mdi-download" :disabled="!sim.episodes.length" @click="downloadCsv">
          Download CSV
        </v-btn>
        <v-btn variant="flat" prepend-icon="mdi-delete-outline" color="red" :disabled="!sim.episodes.length"
               @click="confirmClear = true">
          Clear
        </v-btn>
      </v-card-title>
      <v-data-table
        :headers="episodeHeaders"
        :items="episodeRows"
        density="compact"
        :items-per-page="25"
        :sort-by="[{ key: 'timestamp', order: 'desc' }]"
      >
        <template #item.policy="{ item }">
          <span class="dot" :style="{ background: policyColor(item.policy) }"></span>
          {{ policyName(item.policy) }}
        </template>
        <template #item.delivered="{ item }">
          <v-icon v-if="item.all_delivered" color="green" size="small">mdi-check-circle</v-icon>
          <v-icon v-else color="orange" size="small">mdi-alert-circle</v-icon>
          {{ item.delivered_items }}/{{ item.total_items }}
        </template>
        <template #item.time_s="{ item }">{{ clock(item.time_s) }}</template>
        <template #item.picker_idle_time="{ item }">{{ pct(item.picker_idle_time) }}</template>
        <template #item.mean_reward="{ item }">{{ item.mean_reward.toFixed(3) }}</template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="confirmClear" max-width="420">
      <v-card>
        <v-card-title>Clear all episodes?</v-card-title>
        <v-card-text>
          This removes the {{ sim.episodes.length }} stored episodes from this browser. Download the CSV
          first if you want to keep them.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="confirmClear = false">Cancel</v-btn>
          <v-btn color="red" variant="flat" @click="clearEpisodes">Clear</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { LIVE_STALE_MS, useSimStore } from '~/stores/simStore'

const sim = useSimStore()

// Ticks so "Running" turns off once the sim stops posting.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  sim.load()
  timer = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

const live = computed(() => sim.live)
const running = computed(() => sim.live !== null && now.value - sim.liveAt < LIVE_STALE_MS)

const POLICIES: Record<string, { name: string; color: string }> = {
  rl_stochastic: { name: 'RL (sampled)', color: '#1e88e5' },
  rl_deterministic: { name: 'RL (best action)', color: '#3949ab' },
  assign: { name: 'Assign', color: '#43a047' },
  stay: { name: 'Stay', color: '#00897b' },
  greedy: { name: 'Greedy', color: '#fb8c00' },
  random: { name: 'Random', color: '#8e8e8e' },
  manual: { name: 'Manual', color: '#6d4c41' },
}
const policyName = (p: string) => POLICIES[p]?.name ?? p
const policyColor = (p: string) => POLICIES[p]?.color ?? '#90a4ae'

const pct = (x: number) => `${Math.round(100 * (x || 0))} %`
function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const liveTiles = computed(() => {
  const l = live.value
  if (!l) return []
  return [
    { label: 'Time', value: clock(l.elapsed), sub: l.limit > 0 ? `of ${clock(l.limit)}` : '' },
    { label: 'Delivered', value: l.boxes > 0 ? `${l.delivered} / ${l.boxes}` : `${l.delivered}`, sub: '' },
    { label: 'Throughput', value: `${l.rate.toFixed(1)}`, sub: 'boxes / min' },
    { label: 'Picker idle', value: pct(l.picker_idle_time), sub: '' },
    { label: 'Transporter idle', value: pct(l.transporter_idle_time), sub: `+${pct(l.transporter_parked_time)} parked` },
    { label: 'Done', value: `${l.picks} picks`, sub: `${l.handoffs} hand-offs · ${l.delivery_dockings} deliveries` },
    { label: 'Mean box time', value: l.mean_box_time > 0 ? `${l.mean_box_time.toFixed(0)} s` : '–', sub: 'rack to receiver' },
    { label: 'Failed dockings', value: `${l.failed_dockings}`, sub: `${l.stale} stale` },
    { label: 'Reward', value: l.mean_reward.toFixed(3), sub: 'training formula' },
    { label: 'Policy', value: l.policy_ms > 0 ? `${l.policy_ms.toFixed(0)} ms` : '–', sub: 'round trip' },
  ]
})

// Layout shown in the comparison: the running one, else the latest episode's.
const layout = ref<string | null>(null)
watchEffect(() => {
  if (layout.value && sim.layouts.includes(layout.value)) return
  const latest = sim.episodes[sim.episodes.length - 1]
  layout.value = (running.value && sim.live && sim.layouts.includes(sim.live.layout))
    ? sim.live.layout
    : latest?.layout ?? null
})

const summary = computed(() => (layout.value ? sim.summary(layout.value) : []))

const chart = computed(() => {
  const barHeight = 22
  const gap = 10
  const labelWidth = 150
  const width = 760
  const plot = width - labelWidth - 150
  const max = Math.max(1, ...summary.value.map((s) => s.timeMean + s.timeSd))
  const bars = summary.value.map((s, i) => ({
    policy: s.policy,
    n: s.n,
    mean: s.timeMean,
    y: i * (barHeight + gap) + 4,
    w: (plot * s.timeMean) / max,
    sdW: (plot * s.timeSd) / max,
  }))
  return { width, height: bars.length * (barHeight + gap) + 8, barHeight, labelWidth, bars }
})

const episodeHeaders = [
  { title: 'Finished', key: 'timestamp' },
  { title: 'Layout', key: 'layout' },
  { title: 'Mode', key: 'policy' },
  { title: 'Episode', key: 'episodeNo', align: 'end' as const },
  { title: 'Delivered', key: 'delivered', sortable: false },
  { title: 'Time', key: 'time_s', align: 'end' as const },
  { title: 'Picker idle', key: 'picker_idle_time', align: 'end' as const },
  { title: 'Failed dockings', key: 'failed_dockings', align: 'end' as const },
  { title: 'Reward', key: 'mean_reward', align: 'end' as const },
]
const episodeRows = computed(() => sim.episodes.map((e) => ({ ...e, episodeNo: e.episode + 1 })))

function downloadCsv() {
  const blob = new Blob([sim.csv()], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'simulator-episodes.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const confirmClear = ref(false)
function clearEpisodes() {
  sim.clearEpisodes()
  confirmClear.value = false
}
</script>

<style scoped>
.tile {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 8px 10px;
  height: 100%;
}
.tile-label {
  font-size: 12px;
  color: #757575;
}
.tile-value {
  font-size: 20px;
  font-weight: 500;
}
.tile-sub {
  font-size: 11px;
  color: #9e9e9e;
}
.chart {
  width: 100%;
  max-width: 760px;
  height: auto;
  display: block;
}
.chart-label {
  font-size: 13px;
  fill: #424242;
}
.chart-value {
  font-size: 12px;
  fill: #616161;
}
.chart-whisker {
  stroke: #424242;
  stroke-width: 2;
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
</style>
