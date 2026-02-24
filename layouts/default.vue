<template>
    <v-card>
    <v-layout>
        <v-navigation-drawer
            permanent
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

        <v-main style="height: 100vh">
            <NuxtPage />
        </v-main>
    </v-layout>
</v-card>
</template>
