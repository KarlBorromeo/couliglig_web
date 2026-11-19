<template>
  <iframe
    ref="frame"
    :src="src"
    class="sim-frame"
    title="Warehouse simulator"
    allow="fullscreen; autoplay"
    allowfullscreen
  ></iframe>
</template>

<script setup lang="ts">
// The warehouse simulator: the Godot web export in public/simulator-app/,
// rebuilt with couliglig-gamesim/tools/export_web.sh. The default layout keeps
// this mounted once the Simulator page has been opened, so a run carries on
// while the Analytics page is open.
//
// Start options can be passed through the page URL and are handed to the sim:
// /simulator?layout=New%20Warehouse&mode=rl&speed=4&episodes=1&argmax=1
const config = useRuntimeConfig()
const route = useRoute()
const base = `${config.app.baseURL.replace(/\/$/, '')}/simulator-app/index.html`

// Read once: changing the query later must not restart a running sim.
const query = new URLSearchParams()
for (const key of ['layout', 'mode', 'speed', 'episodes', 'argmax']) {
  const value = route.query[key]
  if (typeof value === 'string' && value !== '') query.set(key, value)
}
// The sim decodes %20 but not "+" as a space.
const qs = query.toString().replace(/\+/g, '%20')
const src = qs ? `${base}?${qs}` : base

const frame = ref<HTMLIFrameElement | null>(null)
defineExpose({ frame })
</script>

<style scoped>
.sim-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: #000;
}
</style>
