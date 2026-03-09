<template>
  <v-container class="d-flex flex-column ga-5">
    <section class="">
      <h1>Robot Mapping</h1>
      <p>Manage and monitor the mapping status of robots in real-time.</p>
    </section>

    <v-card elevation="3">
      <v-card-title class="d-flex align-center">
        <p class="ml-1"><v-icon class="py-0 my-0" color="blue">mdi-robot</v-icon><span class="ml-1">Online Robots</span></p>
        <v-spacer></v-spacer>
        <v-btn variant="flat" prepend-icon="mdi-refresh" @click="refreshRobots">Refresh</v-btn>
      </v-card-title>
      <v-table>
        <thead>
          <tr>
            <th v-for="header in activeRobotHeader" :key="header" class="font-weight-bold" style="color: rgb(105, 105, 105);">
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in activeRobots"
            :key="item.ip"
          >
            <td>{{ item.hostname }}</td>
            <td>{{ item.namespace }}</td>
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
                hide-details
              >
                <v-radio :value="item.hostname" />
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
  const dockStore = useDockStore()
  const activeRobotHeader = [
    'Robot name',
    'Namespace',
    'IP Address',
    'Battery (%)',
    'Mapping'
  ]
  const activeRobots = computed(() => dockStore.onlineRobots)
  let selectedRobot = ref(null)
  let isSlamRunning = ref(false)
  const rosConnections: any[] = []

  function toggleSlam() {
    isSlamRunning.value = !isSlamRunning.value
  }
  function refreshRobots() {
    dockStore.fetchOnlineRobots()
  }
  onMounted(async () => {
    await dockStore.fetchDockConfigs()
    await dockStore.fetchOnlineRobots()

    const ROSLIB = (window as any).ROSLIB
    activeRobots.value.forEach(robot => {
      const ros = new ROSLIB.Ros({
        url: `ws://${robot.ip}:9090`
      })
      rosConnections.push(ros)
      ros.on('connection', () => {
        console.log(`Connected to ROS bridge on ${robot.hostname} at ${robot.ip}`)
      })
      ros.on('error', (error: any) => {
        console.error(`Error connecting to ROS bridge on ${robot.hostname} at ${robot.ip}:`, error)
      })
      ros.on('close', () => {
        console.log(`Connection to ROS bridge on ${robot.hostname} at ${robot.ip} closed`)
      })

      const statusListener = new ROSLIB.Topic({
        ros: ros,
        name: "/couliglig_bot_6/robot_state",
        messageType: "custom_msgs/CouligligStatus"
      })

      statusListener.subscribe((msg: any) => {
        console.log(`Status update from ${robot.hostname} at ${robot.ip}:`, msg)
        const state = msg.state
        dockStore.updateRobotStatus(robot.ip, state)
      })
    })
  })
  onUnmounted(() => {
    console.log("Closing ROS connections...")
    rosConnections.forEach((ros) => ros.close())
  })
</script>