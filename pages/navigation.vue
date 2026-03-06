<template>
  <v-container class="d-flex flex-column ga-5">
    <section class="">
      <h1>Navigation</h1>
      <p>This section allows you to manage the status and navigation of your robots.</p>
    </section>
    <section>
      <v-select
        :items="['Dock 1', 'Dock 2', 'Dock 3']"
        label="Select Configuration"
        variant="outlined"
      ></v-select>
    </section>
    <v-card elevation="3">
      <v-card-title class="d-flex align-center">
        <p class="ml-1"><v-icon class="py-0 my-0" color="green">mdi-robot-excited</v-icon><span class="ml-1">Online Robots</span></p>
        <v-spacer></v-spacer>
        <v-btn variant="flat" prepend-icon="mdi-refresh">Refresh</v-btn>
      </v-card-title>
      <v-table>
        <thead>
          <tr>
            <th v-for="header in itemHeader" :key="header" class="font-weight-bold" style="color: rgb(105, 105, 105);">
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in itemsData"
            :key="item.name"
          >
            <td>{{ item.name }}</td>
            <td>{{ item.ip }}</td>
            <td>{{ item.status }}</td>
            <td><v-checkbox hide-details :disabled="item.status.toUpperCase() !== 'IDLE'" v-model="selectedRobots" :value="item.name"></v-checkbox></td>
          </tr>
        </tbody>
        <v-footer class="d-flex align-center">
          <v-btn variant="flat" prepend-icon="mdi-play" :disabled="selectedRobots.length === 0" :color="selectedRobots.length === 0 ? '' : 'primary'">Start Navigation</v-btn>
        </v-footer>
      </v-table>
    </v-card>
    {{ selectedRobots }}
  </v-container>
</template>

<script setup lang="ts">
  const selectedRobots = ref<string[]>([])
  const itemHeader = ['Robot Name', 'IP Address', 'Navigation Status', 'Select']
  const itemsData = [
    { name: 'Robot 1', ip: '192.168.20.102', status: 'Idle' },
    { name: 'Robot 2', ip: '192.168.20.103', status: 'Navigating to Dock 1' },
    { name: 'Robot 3', ip: '192.168.20.104', status: 'Charging at Dock 2' },
    { name: 'Robot 4', ip: '192.168.20.105', status: 'Idle' },
]
</script>