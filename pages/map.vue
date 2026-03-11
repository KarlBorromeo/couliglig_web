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
            <td>{{ item.status }}</td>
            <td>
              <v-radio-group
                v-model="selectedRobot"
                inline
                hide-details
                v-if="item.status.toUpperCase() === 'IDLE' || item.status.toUpperCase() === 'MAPPING'"
              >
                <v-radio :value="item.ip" />
              </v-radio-group>
            </td>
          </tr>
        </tbody>
      </v-table>     
    </v-card>

    <v-col>
      <section class="d-flex flex-wrap ga-2">
        <v-btn :disabled="!selectedRobot" elevation="2" color="primary" @click="startRobotMapping" prepend-icon="mdi-play" v-if="!isSelectedRobotMapping()">
          Start Slam
        </v-btn>
        <v-btn :disabled="!selectedRobot" elevation="2" color="error" @click="stopRobotMapping" prepend-icon="mdi-stop" v-else>
          Stop Slam
        </v-btn>
        <v-btn :disabled="!selectedRobot" variant="outlined" prepend-icon="mdi-refresh" @click="requestStatusMapping">Status</v-btn>
        <v-btn :disabled="!selectedRobot || !isSelectedRobotMapping()" elevation="2" color="success" prepend-icon="mdi-content-save" @click="saveMap">Save Map</v-btn>
      </section>
      <p>{{ statusText }}</p>
    </v-col>

    <v-card elevation="3">
      <v-card-title ><v-icon size="20">mdi-map-outline</v-icon> Live Map Render</v-card-title>
      <v-card-text>
        <div class="d-flex align-center justify-center" style="height: 700px; background-color: #f5f5f5; border: 1px solid #ddd;">
          <span v-if="!selectedRobot" class="text-center" style="color: #888;">Select a robot to view its map</span>
          <span id="map"/>
        </div>
      </v-card-text>
    </v-card>
    <Snackbar ref="snackbar" />
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
    'Battery (%)',
    'Status',
    'Select'
  ]
  const activeRobots = computed(() => {
    return dockStore.onlineRobots
  })
  let selectedRobot = ref(null)
  const rosConnections: any[] = []

  async function toggleRequestMapping(robotIp: string, command: string) {
    try{
      const res = await fetch(`http://${robotIp}:8000/roslib/slam`, 
        {
          method: "POST",
          body: JSON.stringify({ command : command }),
          headers: { "Content-Type": "application/json" } 
        }
      )
      const data = await res.json()
      statusText.value = data.message
      if (!res.ok) {
        throw new Error(`Failed to start mapping: ${res.statusText}`)
      }
    } catch (error) {
      snackbar?.value.showSnackbar(error, "error")
    }
  }

  async function saveMap() {
      try {
          const response = await fetch(`http://${selectedRobot.value}:8000/slam/save-map`, {
              method: 'POST'
          });

          if (!response.ok) {
              const error = await response.json();
              snackbar?.value.showSnackbar("❌ Error: " + error.detail, "error");
              return;
          }

          const blob = await response.blob();

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `couliglig_map_${Date.now()}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);

          snackbar?.value.showSnackbar("✅ Map saved and downloaded successfully.", "success");

      } catch (err) {
          snackbar?.value.showSnackbar("❌ Failed to save map.", "error");
      }
  }
  
  function refreshRobots() {
    dockStore.fetchOnlineRobots()
  }

  function isSelectedRobotMapping() {
    const robot = activeRobots.value.find(r => r.ip === selectedRobot.value)
    return robot?.status.toUpperCase() === "MAPPING"
  }

  function startRobotMapping() {
    const selectedRobotIp = selectedRobot.value? selectedRobot.value : ""
    if (!selectedRobotIp) return
    toggleRequestMapping(selectedRobotIp, "start")
  }

  function stopRobotMapping() {
    const selectedRobotIp = selectedRobot.value? selectedRobot.value : ""
    if (!selectedRobotIp) return
    toggleRequestMapping(selectedRobotIp, "stop")
  }

  const statusText = ref("")
  function requestStatusMapping() {
    const selectedRobotIp = selectedRobot.value? selectedRobot.value : ""
    if (!selectedRobotIp) return
    toggleRequestMapping(selectedRobotIp, "status")
  }

  onMounted(async () => {
    try{
      // await Promise.reject(new Error("Simulated fetch error"))
      await dockStore.fetchOnlineRobots()
    } catch (error) {
      // console.error("Error fetching dock configs or online robots:", error)
      snackbar?.value.showSnackbar(error, "error")
    }

    const ROSLIB = (window as any).ROSLIB
    const ROS2D = (window as any).ROS2D

    activeRobots.value.forEach((robot: any) => {
      const ros = new ROSLIB.Ros({
        url: `ws://${robot.ip}:9090`
      })
      rosConnections.push(ros)

      const statusListener = new ROSLIB.Topic({
        ros: ros,
        name: `/${robot.namespace}/robot_state`,
        messageType: "custom_msgs/CouligligStatus"
      })

      ros.on('connection', () => {
        console.log(`Connected to ROS bridge on ${robot.hostname} at ${robot.ip}`)
        statusListener.subscribe((msg: any) => {
          // console.log(`Status update from ${robot.hostname} at ${robot.ip}:`, msg)
          const state = msg.state
          dockStore.updateRobotStatus(robot.ip, state)
        }) 
      })

      ros.on('error', (error: any) => {
        console.error(`Error connecting to ROS bridge on ${robot.hostname} at ${robot.ip}:`, error)
      })
    })
  })

  onUnmounted(() => {
    console.log("Closing ROS connections...")
    rosConnections.forEach((ros) => ros.close())
  })
  
  const ros = ref<any>(null)
  watch(selectedRobot, (robotIp) => {
    console.log("Selected robot IP:", robotIp)
    const robot = activeRobots.value.find(r => r.ip === robotIp)
    if (!robot) return

    // close previous connection
    if (ros.value) {
      ros.value.close()
    }

    const ROSLIB = (window as any).ROSLIB
    const ROS2D = (window as any).ROS2D
    const createjs = (window as any).createjs

    ros.value = new ROSLIB.Ros({
      url: `ws://${robot.ip}:9090`
    })

    ros.value.on("connection", () => {

      const mapContainer = document.getElementById("map")
      if (mapContainer) mapContainer.innerHTML = ""

      const viewer = new ROS2D.Viewer({
        divID: "map",
        width: 700,
        height: 700
      })

      const gridClient = new ROS2D.OccupancyGridClient({
        ros: ros.value,
        rootObject: viewer.scene,
        topic: "/map",
        continuous: true
      })

      gridClient.on("change", () => {
        const grid = gridClient.currentGrid
        if (!grid) return

        viewer.scaleToDimensions(grid.width, grid.height)
        viewer.shift(grid.pose.position.x, grid.pose.position.y)

        // console.log('[MAP INFO]', {
        //   resolution: grid.resolution,
        //   width: grid.width,
        //   height: grid.height,
        //   origin: grid.pose.position
        // });
      })

      const tfClient = new ROSLIB.TFClient({
        ros: ros.value,
        fixedFrame: "map",
        angularThres: 0.01,
        transThres: 0.01,
        rate: 10,
        topic: `/${robot.namespace}/tf`,
        staticTopic: `/${robot.namespace}/tf_static`
      })

      const robotMarker = new ROS2D.ArrowShape({
        size: 0.6,
        strokeSize: 0.05,
        strokeColor: createjs.Graphics.getRGB(255,0,0),
        fillColor: createjs.Graphics.getRGB(255,0,0)
      })

      viewer.scene.addChild(robotMarker)

      const tfTopic = new ROSLIB.Topic({
        ros: ros.value,
        name: `/${robot.namespace}/tf`,
        messageType: "tf2_msgs/msg/TFMessage"
      })
      tfTopic.subscribe((msg:any) => {

        msg.transforms.forEach((t:any) => {

          if (t.child_frame_id === "base_footprint") {

            robotMarker.x = t.transform.translation.x
            robotMarker.y = -t.transform.translation.y

            const q = t.transform.rotation

            const yaw = Math.atan2(
              2 * (q.w*q.z + q.x*q.y),
              1 - 2 * (q.y*q.y + q.z*q.z)
            )
            robotMarker.rotation = -yaw * 180 / Math.PI
          }
        })
      })
    })
  })
</script>