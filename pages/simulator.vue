<template>
  <v-container fluid class="d-flex flex-column ga-3 sim-page">
    <v-card elevation="3">
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <p class="ml-1">
          <v-icon class="py-0 my-0" color="blue">mdi-warehouse</v-icon>
          <span class="ml-1">Warehouse Simulator</span>
        </p>
        <v-spacer></v-spacer>
        <v-btn variant="flat" prepend-icon="mdi-home" @click="openMenu">Main menu</v-btn>
        <v-btn variant="flat" prepend-icon="mdi-fullscreen" @click="fullscreen">Fullscreen</v-btn>
        <v-btn variant="flat" prepend-icon="mdi-open-in-new" :href="src" target="_blank">New tab</v-btn>
      </v-card-title>
      <v-card-text class="d-flex align-center flex-wrap ga-3 pb-2">
        <v-text-field
          v-model="layout"
          label="Layout"
          density="compact"
          hide-details
          style="max-width: 220px"
        />
        <v-select
          v-model="mode"
          :items="modes"
          label="Fleet mode"
          density="compact"
          hide-details
          style="max-width: 200px"
        />
        <v-select
          v-model="speed"
          :items="speeds"
          label="Speed"
          density="compact"
          hide-details
          style="max-width: 110px"
        />
        <v-switch v-model="episodes" label="Episodes" color="blue" density="compact" hide-details />
        <v-switch
          v-model="argmax"
          label="RL: best action only"
          color="blue"
          density="compact"
          hide-details
          :disabled="mode !== 'rl'"
        />
        <v-btn color="blue" variant="flat" prepend-icon="mdi-play" @click="start">Start</v-btn>
      </v-card-text>
    </v-card>

    <div class="sim-frame-wrap">
      <iframe
        ref="frame"
        :key="reloads"
        :src="src"
        class="sim-frame"
        title="Warehouse simulator"
        allow="fullscreen; autoplay"
        allowfullscreen
      ></iframe>
    </div>
  </v-container>
</template>

<script setup lang="ts">
// The simulator is the Godot web export in public/simulator-app/, rebuilt from
// the couliglig-gamesim repo. It reads its start options from the URL query:
// ?layout=<name>&mode=<rl|greedy|stay|assign|random|manual>&speed=<1|2|3|4|8>
//  &episodes=1&argmax=1. Without a layout it opens its own main menu.
const config = useRuntimeConfig()
const base = `${config.app.baseURL.replace(/\/$/, '')}/simulator-app/index.html`

const modes = [
  { title: 'RL policy', value: 'rl' },
  { title: 'Assign (heuristic)', value: 'assign' },
  { title: 'Stay (heuristic)', value: 'stay' },
  { title: 'Greedy (heuristic)', value: 'greedy' },
  { title: 'Random', value: 'random' },
  { title: 'Manual', value: 'manual' },
]
const speeds = [1, 2, 3, 4, 8].map((s) => ({ title: `${s}×`, value: s }))

const layout = ref('New Warehouse')
const mode = ref('rl')
const speed = ref(1)
const episodes = ref(true)
const argmax = ref(false)

const src = ref(base)
const reloads = ref(0)
const frame = ref<HTMLIFrameElement | null>(null)

function start() {
  const params = new URLSearchParams({ layout: layout.value.trim(), mode: mode.value, speed: String(speed.value) })
  if (episodes.value) params.set('episodes', '1')
  if (argmax.value && mode.value === 'rl') params.set('argmax', '1')
  load(`${base}?${params.toString().replace(/\+/g, '%20')}`)
}

function openMenu() {
  load(base)
}

// A new key remounts the iframe, so the same URL restarts the simulator too.
function load(url: string) {
  src.value = url
  reloads.value++
}

function fullscreen() {
  frame.value?.requestFullscreen?.()
}
</script>

<style scoped>
.sim-page {
  height: 100%;
}
.sim-frame-wrap {
  /* window height minus the app bar padding, the controls card and gaps */
  height: calc(100vh - 190px);
  min-height: 480px;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background: #000;
}
.sim-frame {
  width: 100%;
  height: 100%;
  min-height: 480px;
  border: 0;
  display: block;
}
</style>
