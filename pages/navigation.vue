<template>
  <v-container class="d-flex flex-column ga-5">
    <section class="d-flex align-center justify-space-between mb-4">
      <section>
        <h1>Navigation</h1>
        <p>This section allows you to manage the status and navigation of your robots.</p>        
      </section>
      <v-btn variant="flat" prepend-icon="mdi-refresh" size="x-large" @click="refresh">Refresh</v-btn>
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
          <p class="ml-1"><v-icon class="py-0 my-0" color="blue">mdi-launch</v-icon><span class="ml-1">Launch Robots</span></p>
          <v-spacer></v-spacer>
        </v-card-title>
        <v-table>
          <thead>
            <tr>
              <th v-for="header in toLaunchRobotHeaders" :key="header" class="font-weight-bold" style="color: rgb(105, 105, 105);">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="activeRobot in toLaunchRobots"
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
              <td><v-checkbox hide-details :disabled="activeRobot.status.toUpperCase() !== 'IDLE'" v-model="selectedRobotsToLaunch" :value="activeRobot.ip"  v-if="activeRobot.status.toUpperCase() === 'IDLE'"></v-checkbox></td>
            </tr>
          </tbody>
          <v-footer class="d-flex align-center">
            <v-btn variant="flat" prepend-icon="mdi-play" :disabled="selectedRobotsToLaunch.length === 0 || !selectedDockConfig" :color="selectedRobotsToLaunch.length === 0 || !selectedDockConfig ? '' : 'primary'" @click="launchRobots">Execute launch</v-btn>
          </v-footer>
        </v-table>
      </v-card>
    </v-col>

    <v-col>
      <v-card elevation="3">
        <v-card-title class="d-flex align-center">
          <p class="ml-1"><v-icon class="py-0 my-0" color="blue">mdi-robot-mower</v-icon><span class="ml-1">Dock Robots</span></p>
          <v-spacer></v-spacer>
        </v-card-title>
        <v-table>
          <thead>
            <tr>
              <th v-for="header in toDockRobotHeaders" :key="header" class="font-weight-bold" style="color: rgb(105, 105, 105);">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="activeRobot in toDockRobots"
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
              <td>
                <v-radio-group
                  v-model="selectedRobotToDock"
                  inline
                  hide-details
                  v-if="activeRobot.status.toUpperCase() === 'READY'"
                >
                  <v-radio :value="activeRobot.ip" />
                </v-radio-group>
              </td>
              <td>
                <v-btn variant="flat" density="comfortable" rounded="xl" size="small" color="error" block icon @click="stopRobot(activeRobot.ip)">Stop</v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
        <v-footer >
          <v-row >
            <v-col cols="auto">
              <v-btn variant="flat" prepend-icon="mdi-play" :disabled="!selectedRobotToDock || !selectedDockConfig || !selectedDockId" :color="!selectedRobotToDock || !selectedDockConfig || !selectedDockId ? '' : 'primary'" @click="dockRobot">Dock Robot</v-btn>
            </v-col>
            <v-col cols="12" sm="4" md="4" lg="3" xl="2">
              <v-select
                :items="docks"
                item-title="dock_id"
                item-value="dock_id"
                label="Select Dock"
                v-model="selectedDockId"
                variant="outlined"
                hide-details
                density="compact"
                class="ml-4"
                hint="Pick your favorite states"
                persistent-hint
              />
            </v-col>
            <v-spacer />
          </v-row>
          </v-footer>
      </v-card>
    </v-col>

    <v-col>
      <v-card elevation="3">
        <v-card-title ><v-icon size="20">mdi-map-outline</v-icon> Live Map Render</v-card-title>
        <v-card-text>
          <div class="d-flex align-center justify-center" style="height: 600px; background-color: #f5f5f5; border: 1px solid #ddd;">
            <!-- <span class="text-center" style="color: #888;">Map is shown here</span> -->
            <span id="map"/>
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col>
      <v-card elevation="3">
        <v-card-title class="d-flex align-center">
          <p class="ml-1"><v-icon class="py-0 my-0" color="blue">mdi-package-variant</v-icon><span class="ml-1">Spawn Box</span></p>
          <v-spacer></v-spacer>
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
              <td>{{ dock.dock_id}}</td>
              <td>{{ dock.x }}</td>
              <td>{{ dock.y }}</td>
              <td>{{ dock.theta }}</td>
              <td>{{ dock.aruco_id }}</td>
              <td>
                <v-switch inset hide-details color="primary"></v-switch>
              </td>
            </tr>
          </tbody>
          <v-footer class="d-flex align-center">
            <v-btn variant="flat" prepend-icon="mdi-chart-timeline-variant-shimmer" color="primary">Update Dock States</v-btn>
          </v-footer>
        </v-table>
      </v-card>
    </v-col>
    <Snackbar ref="snackbar" />
  </v-container>
</template>

<script setup lang="ts">
import Snackbar from '~/components/snackbar.vue'


  const dockStore = useDockStore()
  const selectedRobotsToLaunch = ref<string[]>([])
  const selectedRobotToDock = ref(null)
  const selectedDockConfig = ref<number | null>(null)
  const selectedDockId = ref(null)
  const toLaunchRobotHeaders = ['Robot Name', 'Namespace', 'IP Address', 'ROS ID', 'Battery','Status', 'Select']
  const toDockRobotHeaders = ['Robot Name', 'Namespace', 'IP Address', 'ROS ID', 'Battery','Status', 'Select', 'Stop']
  const dockHeaders = ['Dock ID', 'Pose X', 'Pose Y', 'Theta', 'Aruco ID', 'Spawn Box']
  const dockConfigs = computed(() => dockStore.dockConfigs)
  const toLaunchRobots = computed(() => dockStore.toLaunchRobots)
  const toDockRobots = computed(() => dockStore.toDockRobots)
  const docks = computed(() => dockStore.docks)
  const rosConnections: any[] = []
  const snackbar = ref<any>(null)

  function refresh() {
    dockStore.fetchDockConfigs()
    if (selectedDockConfig.value) {
      dockStore.fetchDocks(selectedDockConfig.value)
    }
    dockStore.fetchOnlineRobots()
  }

  async function launchRobots() {
    try {
      const robot_data = selectedRobotsToLaunch.value.map(ip => {
        const robot = toLaunchRobots.value.find(robot => robot.ip === ip)
        if (robot) {
          return {
            namespace: robot.namespace,
            robot_ip: robot.ip
          }
        } else {
          throw new Error(`Robot with IP ${ip} not found in toLaunchRobots`)
        } 
      })
      selectedRobotsToLaunch.value = []
      await dockStore.actionRunNavigation(selectedDockConfig.value!, robot_data)
      snackbar?.value.showSnackbar("Navigation launched successfully", "success")
    } catch (error) {
      snackbar?.value.showSnackbar(error, "error")
    }

  }

  async function dockRobot() {
    try {
      if (!selectedRobotToDock.value || !selectedDockConfig.value || !selectedDockId.value) {
        throw new Error("Please select a robot, dock configuration, and dock to proceed with docking.")
      }

      const selectedRobot = toDockRobots.value.find(robot => robot.ip === selectedRobotToDock.value)
      if (!selectedRobot) {
        throw new Error(`Selected robot with IP ${selectedRobotToDock.value} not found in navigating robots.`)
      }

      const formData = new FormData();
      formData.append("dock_id", selectedDockId.value);
      const response = await fetch(`http://${selectedRobot.ip}:8000/roslib/dock`, {
          method: "POST",
          body: formData
      });

      const result = await response.json();
      console.log(result)
      snackbar?.value.showSnackbar(result.message, "success")
    } catch (error) {
      snackbar?.value.showSnackbar(error, "error")
    }
  }

  async function stopRobot(robotIp: string){
    try {
      const selectedStopRobot = toDockRobots.value.find(robot => robot.ip === robotIp)
      if (!selectedStopRobot) {
        throw new Error(`Selected robot with IP ${robotIp} not found in navigating robots.`)
      }
      const formData = new URLSearchParams({
        command: "stop",
        enable_commander: "true",
        x_val: "0.0",
        y_val: "0.0"
      })
      const response = await fetch(`http://${selectedStopRobot.ip}:8000/roslib/nav`, {
          method: "POST",
          body: formData,
      });
      const res = await response.json()
      if (res.success) {
        snackbar?.value.showSnackbar(res.message, "success")
      } else {
        throw new Error(res.message || "Failed to stop the robot.")
      }
    } catch (error) {
      snackbar?.value.showSnackbar(error, "error")
    }
  }

  onMounted(async () => {
    try{
      // await Promise.reject(new Error("Simulated fetch error"))
      await dockStore.fetchDockConfigs()
      await dockStore.fetchOnlineRobots()
    } catch (error) {
      // console.error("Error fetching dock configs or online robots:", error)
      snackbar?.value.showSnackbar(error, "error")
    }
    const onlineRobots = dockStore.onlineRobots
    const ROSLIB = (window as any).ROSLIB
    onlineRobots.forEach(robot => {
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

  watch (selectedDockConfig, async (newConfigId) => {
    console.log("Selected dock config ID:", newConfigId)
    selectedDockId.value = null
    selectedRobotToDock.value = null
    selectedRobotsToLaunch.value = []
    if (newConfigId) {
      try{
        // await Promise.reject(new Error("Simulated fetch error"))
        await dockStore.fetchDocks(newConfigId)
      } catch (error) {
        snackbar?.value.showSnackbar(error, "error")
      }
      
    }
  })

  let viewer:any = null
  let rosMapConnection:any = null
  let mapProviderIp: string | null = null

  let rosMarkerConnections: any[] = []
  let markerProviderIPs: string[] = []
  let robotMarkers: Record<string, any> = {}
  let mapOdom: Record<string, any> = {}
  let odomBase: Record<string, any> = {}
  let odomBaseRot: Record<string, any> = {}

  const colors = [
    [255, 0, 0],    // red
    [0, 150, 255],  // blue
    [0, 200, 100],  // green
    [255, 150, 0],  // orange
    [200, 0, 255],  // purple
    [255, 50, 120], // pink
  ]
  
  watch(toDockRobots, async (robots) => {

    const ROS2D = (window as any).ROS2D
    const ROSLIB = (window as any).ROSLIB
    const createjs = (window as any).createjs

    // remove all connections and markers if no robots are running
    if (robots.length === 0) {
      // console.log("No running robots detected.")
      if (viewer) {
        viewer.scene.clear()
        viewer = null
        const div = document.getElementById("map")
        if (div) {
          div.innerHTML = ""
        }
      }
      if (rosMapConnection) {
        rosMapConnection.close()
        rosMapConnection = null
      }
      mapProviderIp = null
      
      rosMarkerConnections.forEach((ros) => ros.close())
      rosMarkerConnections.length = 0
      markerProviderIPs.length = 0
      for (const ip in robotMarkers) {
        delete robotMarkers[ip]
      }
      for (const ip in mapOdom) {
        delete mapOdom[ip]
      }
      for (const ip in odomBase) {
        delete odomBase[ip]
      }
      for (const ip in odomBaseRot) {
        delete odomBaseRot[ip]
      }
      return
    }  

    // cleanup connections and markers for robots that are no longer running
    const activeIpKeys = toDockRobots.value.map(robot => robot.ip)
    const tempMarkerProviderIPs = [...markerProviderIPs]
    tempMarkerProviderIPs.forEach((ip, ind) => {
      if (!activeIpKeys.includes(ip)) {

        markerProviderIPs.splice(ind, 1)

        rosMarkerConnections[ind].close()
        rosMarkerConnections.splice(ind, 1)

        if (robotMarkers[ip]) {
          viewer.scene.removeChild(robotMarkers[ip])
          delete robotMarkers[ip]
        }

        delete mapOdom[ip]
        delete odomBase[ip]
        delete odomBaseRot[ip]
      }
    })
    // console.log("Marker provider IPs before cleanup:", markerProviderIPs)
    // console.log("ROS marker connections before cleanup:", rosMarkerConnections)
    // console.log("Robot markers before cleanup:", robotMarkers)
    // console.log("Map Odom", mapOdom)
    // console.log("Odom Base", odomBase)
    // console.log("Odom Base Rot", odomBaseRot)

    // console.log("Running robots detected:", robots.map((r:any) => r.hostname).join(", "))
    initMap(ROSLIB,ROS2D)
    drawArrowToViewer(ROSLIB, ROS2D, createjs)
  })

  function initMap(ROSLIB: any, ROS2D: any) {

    const firstRobot: any = toDockRobots.value[0]

    // If already connected to this robot, do nothing
    if (mapProviderIp === firstRobot.ip) {
      return
    }

    // Close previous map connection
    rosMapConnection?.close()
    rosMapConnection = null

    // Update the map provider IP
    mapProviderIp = firstRobot.ip

    // Clear previous viewer if it exists
    if (viewer) {
      viewer.scene.removeAllChildren()
    } else {
      viewer = new ROS2D.Viewer({
        divID: "map",
        width: 500,
        height: 500
      })
    }

    rosMapConnection = new ROSLIB.Ros({
      url: `ws://${mapProviderIp}:9090`
    })

    rosMapConnection.on("connection", () => {

      console.log(`Connected to ROS bridge on ${firstRobot.hostname} at ${firstRobot.ip} for map visualization.`)

      const gridClient = new ROS2D.OccupancyGridClient({
        ros: rosMapConnection,
        rootObject: viewer.scene,
        topic: "/map",
        continuous: false
      })

      gridClient.on("change", () => {
        const grid = gridClient.currentGrid
        if (!grid) return

        viewer.scaleToDimensions(grid.width, grid.height)
        viewer.shift(grid.pose.position.x, grid.pose.position.y)
      })

      // reattach existing markers to new viewer
      Object.values(robotMarkers).forEach((marker:any) => {
        viewer.scene.addChild(marker)
      })
    })
  }



  function drawArrowToViewer(ROSLIB: any, ROS2D: any, createjs: any) {

    toDockRobots.value.forEach((robot:any, index:number) => {

      if (markerProviderIPs.includes(robot.ip)) {
        return
      }

      markerProviderIPs.push(robot.ip)

      const ros = new ROSLIB.Ros({
        url: `ws://${robot.ip}:9090`
      })

      rosMarkerConnections.push(ros)

      ros.on("connection", () => {

        console.log(`Connected to ROS bridge on ${robot.hostname} at ${robot.ip}`)

        const color = colors[index % colors.length]

        const robotMarker = new ROS2D.ArrowShape({
          size: 0.6,
          strokeSize: 0.05,
          strokeColor: createjs.Graphics.getRGB(...color),
          fillColor: createjs.Graphics.getRGB(...color)
        })

        robotMarkers[robot.ip] = robotMarker
        viewer.scene.addChild(robotMarker)

        const tfTopic = new ROSLIB.Topic({
          ros: ros,
          name: `/${robot.namespace}/tf`,
          messageType: "tf2_msgs/msg/TFMessage"
        })

        tfTopic.subscribe((msg:any) => {

          msg.transforms.forEach((t:any) => {

            const parent = t.header.frame_id
            const child = t.child_frame_id

            // console.log(robot.hostname, parent, "→", child)

            // map -> odom
            if (child.endsWith("odom") && parent.endsWith("map")) {
              mapOdom[robot.ip] = t.transform.translation
            }

            // odom -> base_footprint
            if (child.endsWith("base_footprint") && parent.endsWith("odom")) {
              odomBase[robot.ip] = t.transform.translation
              odomBaseRot[robot.ip] = t.transform.rotation
            }

            // when both are available compute map -> base
            if (mapOdom[robot.ip] && odomBase[robot.ip]) {

              const marker = robotMarkers[robot.ip]

              const x = mapOdom[robot.ip].x + odomBase[robot.ip].x
              const y = mapOdom[robot.ip].y + odomBase[robot.ip].y

              marker.x = x
              marker.y = -y

              const q = odomBaseRot[robot.ip]

              const yaw = Math.atan2(
                2 * (q.w*q.z + q.x*q.y),
                1 - 2 * (q.y*q.y + q.z*q.z)
              )

              marker.rotation = -yaw * 180 / Math.PI
            }
          })
        })
      })
    })
  }
</script>