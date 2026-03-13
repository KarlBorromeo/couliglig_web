<template>
  <v-container>
    <v-card elevation="3">
      <v-card-title class="d-flex align-center">
        <p class="ml-1"><v-icon class="py-0 my-0" color="blue">mdi-robot</v-icon><span class="ml-1">Online Robots</span></p>
        <v-spacer></v-spacer>
        <v-btn variant="flat" prepend-icon="mdi-refresh" @click="refreshRobots">Refresh</v-btn>
      </v-card-title>
      <v-table>
        <thead>
          <tr>
            <th v-for="header in activeRobotHeader" :key="header">
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
            <td>{{ item.status }}</td>
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
          </tr>
        </tbody>
      </v-table>
    </v-card>
    <Snackbar ref="snackbar" />
    <LoadingScreen v-model="loading" />
  </v-container>
</template>
<script setup lang="ts">
import Snackbar from '~/components/snackbar.vue'
  const snackbar = ref<any>(null)
  const dockStore = useDockStore()
  const activeRobotHeader = [
    'Robot name',
    'Namespace',
    'IP Address',
    'Status',
    'Battery (%)',
  ]
  const activeRobots = computed(() => dockStore.onlineRobots)
  const rosConnections: any[] = []
  const loading = ref(false)

  async function refreshRobots() {
    loading.value = true
    await dockStore.fetchOnlineRobots()
    loading.value = false
  }

  onMounted(async () => {
    try{
      loading.value = true
      // await Promise.reject(new Error("Simulated fetch error"))
      await dockStore.fetchOnlineRobots()
      loading.value = false
    } catch (error) {
      loading.value = false
      // console.error("Error fetching dock configs or online robots:", error)
      snackbar?.value.showSnackbar(error, "error")
    }

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
        name: `/${robot.namespace}/robot_state`,
        messageType: "custom_msgs/CouligligStatus"
      })

      statusListener.subscribe((msg: any) => {
        // console.log(`Status update from ${robot.hostname} at ${robot.ip}:`, msg)
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