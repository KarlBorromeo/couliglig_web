<template>
  <v-container class="d-flex flex-column ga-5">
    <section class="">
      <h1>Navigation</h1>
      <p>This section allows you to manage the status and navigation of your robots.</p>
    </section>
    <v-col>
      <section class="d-flex flex-column">
        <v-select
          :items="dockConfigs"
          item-title="name"
          item-value="id"
          label="Select Configuration"
          v-model="selectedDockConfig"
          variant="outlined"
          hide-details
          clearable
        ></v-select>
        <p class="text-caption">Description: {{ selectedDockConfig ? dockConfigs.find(config => config.id === selectedDockConfig)?.description : '' }}</p>
      </section>
    </v-col>
    <v-col>
      <v-card elevation="3">
        <v-card-title class="d-flex align-center">
          <p class="ml-1"><v-icon class="py-0 my-0" color="blue">mdi-robot</v-icon><span class="ml-1">Robots Online</span></p>
          <v-spacer></v-spacer>
          <v-btn variant="flat" prepend-icon="mdi-refresh">Refresh</v-btn>
        </v-card-title>
        <v-table>
          <thead>
            <tr>
              <th v-for="header in activeRobotHeaders" :key="header" class="font-weight-bold" style="color: rgb(105, 105, 105);">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="activeRobot in activeRobots"
              :key="activeRobot.ip"
            >
              <td>{{ activeRobot.hostname }}</td>
              <td>{{ activeRobot.namespace }}</td>
              <td>{{ activeRobot.ip }}</td>
              <td>{{ activeRobot.ros_domain_id }}</td>
              <td>
                <v-icon color="green" v-if="activeRobot.battery > 75">
                  mdi-battery-high
                </v-icon>
                <v-icon color="orange" v-else-if="activeRobot.battery > 50">
                  mdi-battery-medium
                </v-icon>
                <v-icon color="red" v-else>
                  mdi-battery-low
                </v-icon>
                {{ activeRobot.battery }}%
              </td>
              <td>
                {{ activeRobot.status }}
              </td>
              <td><v-checkbox hide-details :disabled="activeRobot.status.toUpperCase() !== 'IDLE'" v-model="selectedRobots" :value="activeRobot.ip"></v-checkbox></td>
            </tr>
          </tbody>
          <v-footer class="d-flex align-center">
            <v-btn variant="flat" prepend-icon="mdi-play" :disabled="selectedRobots.length === 0 || !selectedDockConfig" :color="selectedRobots.length === 0 || !selectedDockConfig ? '' : 'primary'" size="small">Execute launch</v-btn>
          </v-footer>
        </v-table>
      </v-card>
    </v-col>

    <v-col>
      <v-card elevation="3">
        <v-card-title class="d-flex align-center">
          <p class="ml-1"><v-icon class="py-0 my-0" color="blue">mdi-package-variant</v-icon><span class="ml-1">Spawn Box</span></p>
          <v-spacer></v-spacer>
          <v-btn variant="flat" prepend-icon="mdi-refresh">Refresh</v-btn>
        </v-card-title>
        <v-table>
          <thead>
            <tr>
              <th v-for="header in dockHeaders" :key="header" class="font-weight-bold" style="color: rgb(105, 105, 105);">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dock in docks" :key="dock.id">
              <td>{{ dock.id }}</td>
              <td>{{ dock.x }}</td>
              <td>{{ dock.y }}</td>
              <td>{{ dock.theta }}</td>
              <td>{{ dock.arucoId }}</td>
              <td>
                <v-switch inset hide-details color="primary"></v-switch>
              </td>
            </tr>
          </tbody>
          <v-footer class="d-flex align-center">
            <v-btn variant="flat" prepend-icon="mdi-chart-timeline-variant-shimmer" color="primary" size="small">Update Dock States</v-btn>
          </v-footer>
        </v-table>
      </v-card>
    </v-col>
  </v-container>
</template>

<script setup lang="ts">
  const dockStore = useDockStore()
  const selectedRobots = ref<string[]>([])
  const selectedDockConfig = ref<number | null>(null)
  const activeRobotHeaders = ['Robot Name', 'Namespace', 'IP Address', 'ROS ID', 'Battery','Status', 'Select']
  const dockHeaders = ['Dock ID', 'Pose X', 'Pose Y', 'Theta', 'Aruco ID', 'Spawn Box']
  const docks = [
    { id: 'Dock 1', x: '2.5', y: '3.0', theta: '90°', arucoId: 'Aruco 1' },
    { id: 'Dock 2', x: '5.0', y: '1.5', theta: '180°', arucoId: 'Aruco 2' },
    { id: 'Dock 3', x: '1.0', y: '4.0', theta: '270°', arucoId: 'Aruco 3' },
  ]
  const dockConfigs = computed(() => dockStore.dockConfigs)
  const activeRobots = computed(() => dockStore.onlineRobots)
  const rosConnections: any[] = []

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