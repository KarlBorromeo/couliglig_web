<template>
  <v-card elevation="3">
    <v-card-title class="d-flex align-center">
      <v-icon size="20" color="blue">mdi-video</v-icon>
      <span class="ml-1">Camera</span>
      <span v-if="label" class="ml-1 text-medium-emphasis text-body-2">· {{ label }}</span>
      <v-spacer />
      <v-btn
        v-if="src"
        icon="mdi-open-in-new"
        size="small"
        variant="text"
        :href="src"
        target="_blank"
        rel="noopener"
        title="Open in new tab"
      />
      <v-btn
        :icon="collapsed ? 'mdi-chevron-down' : 'mdi-chevron-up'"
        size="small"
        variant="text"
        :title="collapsed ? 'Show camera' : 'Hide camera'"
        @click="emit('update:collapsed', !collapsed)"
      />
    </v-card-title>

    <v-card-text v-if="!collapsed">
      <v-responsive :aspect-ratio="16 / 9" style="background-color: #f5f5f5; border: 1px solid #ddd;">
        <!-- keyed by src so switching robots tears down the old WebRTC session -->
        <iframe
          v-if="src"
          :key="src"
          :src="src"
          class="w-100 h-100"
          style="display: block;"
          frameborder="0"
          allow="autoplay; fullscreen"
          allowfullscreen
        ></iframe>
        <div v-else class="d-flex align-center justify-center h-100" style="color: #888;">
          Select a robot to view its camera
        </div>
      </v-responsive>
      <p v-if="src" class="mt-2 text-caption text-medium-emphasis">
        Detector view: dock markers are outlined when seen. A blank feed while mapping
        means the dock detector isn't running (<code>auto_detect_docks:=false</code>).
      </p>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  src: string | null
  label?: string
  collapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void
}>()
</script>
