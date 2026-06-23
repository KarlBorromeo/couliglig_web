<template>
  <v-layout>
    <!-- App bar: shows a hamburger toggle on small screens -->
    <v-app-bar v-if="mobile" flat border="b">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>COULIGLIG</v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer
      v-model="drawer"
      :permanent="!mobile"
      :temporary="mobile"
    >
      <v-list>
        <v-card-title class="text-center">COULIGLIG</v-card-title>
      </v-list>

      <v-divider></v-divider>

      <v-list density="compact" nav>
        <v-list-item prepend-icon="mdi-view-dashboard" title="Dashboard" value="dashboard" to="/dashboard"></v-list-item>
        <v-list-group prepend-icon="mdi-map">
          <template #activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-map"
              title="Map and Database"
            />
          </template>
          <v-list-item prepend-icon="mdi-map" title="Map" value="map" to="/map"></v-list-item>
          <v-list-item prepend-icon="mdi-database" title="Database" value="database" to="/database"></v-list-item>
        </v-list-group>
        <v-list-item prepend-icon="mdi-robot" title="Navigation" value="navigation" to="/navigation"></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main class="main-content">
      <NuxtPage />
    </v-main>
  </v-layout>
</template>

<script setup>
import { useDisplay } from 'vuetify'

const { mobile } = useDisplay()

// Drawer is open by default on desktop, closed on mobile.
const drawer = ref(!mobile.value)

watch(mobile, (isMobile) => {
  drawer.value = !isMobile
})
</script>

<style scoped>
.main-content {
  min-height: 100vh;
}
</style>
