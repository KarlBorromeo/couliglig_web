<template>
  <v-container class="d-flex flex-column ga-5">
    <section class="">
      <h1>Robot Mapping</h1>
      <p>Manage and monitor the mapping status of robots in real-time.</p>
    </section>

    <v-card elevation="3">
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
            <td>
              <v-icon color="green" v-if="item.battery > 75">
                mdi-battery-high
              </v-icon>
              <v-icon color="orange" v-else-if="item.battery > 50">
                mdi-battery-medium
              </v-icon>
              <v-icon color="red" v-else>
                mdi-battery-low
              </v-icon>
              {{ item.battery }}%
            </td>
            <td>
              <v-radio-group
                v-model="selectedRobot"
                inline
              >
                <v-radio :value="item.name" />
              </v-radio-group>
            </td>
          </tr>
        </tbody>
      </v-table>     
    </v-card>

    <v-col>
      <section class="d-flex flex-wrap ga-2">
        <v-btn :disabled="!selectedRobot" elevation="2" :color="isSlamRunning ? 'error' : 'primary'" @click="toggleSlam" :prepend-icon="isSlamRunning ? 'mdi-stop' : 'mdi-play'">
          {{ isSlamRunning ? 'Stop Slam' : 'Start Slam' }}
        </v-btn>
        <v-btn :disabled="!selectedRobot || !isSlamRunning" variant="outlined" prepend-icon="mdi-refresh">Status</v-btn>
        <v-btn :disabled="!selectedRobot || !isSlamRunning" elevation="2" color="success" prepend-icon="mdi-content-save">Save Map</v-btn>
      </section>
    </v-col>

    <v-card elevation="3">
      <v-card-title ><v-icon size="20">mdi-map-outline</v-icon> Live Map Render</v-card-title>
      <v-card-text>
        <div class="d-flex align-center justify-center" style="height: 300px; background-color: #f5f5f5; border: 1px solid #ddd;">
          <span class="text-muted">Map rendering will be displayed here.</span>
        </div>
      </v-card-text>
    </v-card> 
  </v-container>
</template>

<script setup lang="ts">
const itemHeader = [
    'Robot name',
    'IP Address',
    'Battery (%)',
    'Mapping'
  ]
  const itemsData = [
    {
      name: 'Robot 1',
      ip: '192.168.1.1',
      battery: 85,
    },
    {
      name: 'Robot 2',
      ip: '192.168.1.2',
      battery: 60,
    },
    {
      name: 'Robot 3',
      ip: '192.168.1.3',
      battery: 40,
    },
  ]
  let selectedRobot = ref(null)
  let isSlamRunning = ref(false)

  function toggleSlam() {
    isSlamRunning.value = !isSlamRunning.value
  }
</script>