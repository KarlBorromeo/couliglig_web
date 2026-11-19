<template>
    <v-layout>
        <v-app-bar
            v-if="$vuetify.display.mobile"
            app
            color="white"
            elevation="1"
            >
            <v-app-bar-nav-icon
                variant="text"
                @click.stop="drawer = !drawer"
            />
        </v-app-bar>
        <v-navigation-drawer
            v-model="drawer"
            :location="$vuetify.display.mobile ? 'left' : undefined"
            
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
                <v-list-item prepend-icon="mdi-map" title="Map" value="map" to="/map" link></v-list-item>
                <v-list-item prepend-icon="mdi-database" title="Database" value="database" to="/database"></v-list-item>
            </v-list-group>
            <v-list-item prepend-icon="mdi-robot" title="Create Config" value="create-config" to="/create-config"></v-list-item>
            <v-list-item prepend-icon="mdi-file-edit" title="Edit Config" value="edit-config" to="/edit-config"></v-list-item>
            <v-list-item prepend-icon="mdi-navigation" title="Navigation" value="navigation" to="/navigation"></v-list-item>
            <v-list-group prepend-icon="mdi-warehouse">
                <template #activator="{ props }">
                    <v-list-item
                        v-bind="props"
                        prepend-icon="mdi-warehouse"
                        title="Simulator"
                    />
                </template>
                <v-list-item prepend-icon="mdi-play-box-outline" title="Run" value="simulator" to="/simulator"></v-list-item>
                <v-list-item prepend-icon="mdi-chart-bar" title="Analytics" value="simulator-analytics" to="/simulator-analytics"></v-list-item>
            </v-list-group>
            </v-list>
        </v-navigation-drawer>

        <v-main style="height: 100vh; overflow-y: auto;" :class="$vuetify.display.mobile ? 'mt-20' : (onSimulator ? '' : 'pt-12')">
            <NuxtPage />
            <!-- Mounted on the first visit to /simulator and then kept, hidden on
                 other pages, so a running simulation survives switching pages. -->
            <div v-if="simOpened" v-show="onSimulator" class="sim-host">
                <SimulatorFrame />
            </div>
        </v-main>
    </v-layout>
</template>

<script setup lang="ts">
    const drawer = ref(false)

    const route = useRoute()
    const onSimulator = computed(() => route.path === '/simulator')
    const simOpened = useState('simOpened', () => false)
    watch(onSimulator, (on) => { if (on) simOpened.value = true }, { immediate: true })
</script>

<style scoped>
    /* Fills the main area below the top padding. */
    .sim-host {
        height: 100%;
    }
</style>
