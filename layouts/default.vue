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
            <v-list-item prepend-icon="mdi-navigation" title="Navigation" value="navigation" to="/navigation"></v-list-item>
            </v-list>
        </v-navigation-drawer>

        <v-main style="height: 100vh; overflow-y: auto;" :class="$vuetify.display.mobile ? 'mt-20' : 'pt-12'">
            <NuxtPage />
        </v-main>
    </v-layout>
</template>

<script setup lang="ts">
    const drawer = ref(false)
</script>
