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
          :disabled="!activateButton"
        ></v-select>
        <p class="text-caption">Description: {{ selectedDockConfig ? dockConfigs.find(config => config.id === selectedDockConfig)?.description : '' }}</p>
        <v-btn color="primary" v-if="activateButton" @click="activateConfig" :disabled="!selectedDockConfig">Activate</v-btn>
        <v-btn color="secondary" v-else @click="deactivateConfig">Deactivate</v-btn>
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
            <v-col>
              <v-btn variant="plain" prepend-icon="mdi-home-circle-outline" v-if="selectedDockConfig && selectedRobotToDock" @click="goToInitialPose()">
                Go to initial pose
              </v-btn>              
            </v-col>
          </v-row>
          </v-footer>
      </v-card>
    </v-col>
    <v-col>
      <v-row>
        <v-col cols="12" :lg="cameraSrc ? 8 : 12">
          <v-card elevation="3">
            <v-card-title class="d-flex align-center flex-wrap ga-2">
              <span class="d-flex align-center">
                <v-icon size="20">mdi-map-outline</v-icon>
                <span class="ml-1">Live Map</span>
              </span>
              <v-spacer />
              <div class="layer-toggles" role="group" aria-label="Map layers">
                <button
                  v-for="layer in LAYER_TOGGLES"
                  :id="`layer-${layer.key}`"
                  :key="layer.key"
                  type="button"
                  :aria-pressed="mapLayers[layer.key]"
                  @click="mapLayers[layer.key] = !mapLayers[layer.key]"
                >
                  <i :style="{ background: layer.color }" />{{ layer.label }}
                </button>
              </div>
            </v-card-title>
            <v-card-text>
              <MapViewer
                ref="mapViewer"
                height="min(70vh, 680px)"
                :empty-text="toDockRobots.length ? 'Waiting for /map…' : 'The map appears when a robot is navigating'"
                :robots="mapRobots"
                :docks="mapDocks"
                :selected-robot-id="selectedRobotToDock"
                :selected-dock-id="selectedDockId"
                :follow-robot-id="selectedRobotToDock"
                :layers="mapLayers"
                :fit-pad-top="70"
                @select-robot="onMapSelectRobot"
                @select-dock="onMapSelectDock"
              >
                <template #status>
                  <strong>{{ mapInfo.title }}</strong>
                  <div v-for="line in mapInfo.lines" :key="line" class="map-info-line">{{ line }}</div>
                </template>
                <template #legend>
                  <div class="map-legend">
                    <template v-for="robot in toDockRobots" :key="robot.ip">
                      <span class="sw robot" :style="{ background: robotColor(robot.namespace) }" />
                      <span>{{ shortName(robot.namespace) }}</span>
                    </template>
                  </div>
                </template>
              </MapViewer>
              <p class="mt-2 text-caption text-medium-emphasis">
                Click a ready robot to pick it for docking, or a dock to pick it as the target.
                Docks: P pickup · R receiver · W waiting zone · H hand-off; a box means an item is waiting.
                Costmaps are shown for the robot picked for docking.
              </p>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col v-if="cameraSrc" cols="12" lg="4">
          <CameraFeedCard
            :src="cameraSrc"
            :label="selectedNamespace ?? undefined"
            :collapsed="cameraCollapsed"
            @update:collapsed="setCameraCollapsed"
          />
        </v-col>
      </v-row>
    </v-col>

    <v-col>
      <v-card elevation="3">
        <v-card-title class="d-flex align-center">
          <p class="ml-1"><v-icon class="py-0 my-0" color="blue">mdi-package-variant</v-icon><span class="ml-1">Spawn Box</span></p>
          <v-spacer></v-spacer>
          <v-btn variant="flat" prepend-icon="mdi-refresh" @click="refreshDocks">Refresh</v-btn>
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
            <tr v-for="dock in dock_pickups" :key="dock.dock_id">
              <td>{{ dock.dock_id}}</td>
              <td>{{ dock.dock_type }}</td>
              <td>{{ dock.status }}</td>
              <td>{{ dock.robot_id }}</td>
              <td>
                <p v-if="dock.item_id">{{ dock.item_id }}</p>
                <v-text-field
                  v-else
                  v-model="getDockItem(dock.dock_id).item_id"
                  type="text"
                  variant="underlined"
                  hide-details
                  density="compact"
                  width="50px"
                  min="0"
                  max="10"
                  class="text-center"
                />
              </td>
              <td>
                <p v-if="dock.item_id">{{ dock.item_weight }}</p>
                <v-text-field
                  v-else
                  v-model="getDockItem(dock.dock_id).item_weight"
                  type="number"
                  variant="underlined"
                  hide-details
                  density="compact"
                  width="50px"
                  min="0"
                  max="10"
                  class="text-center"
                />
              </td>
              <td>
                <p v-if="dock.item_id ">{{ dock.receiver_dock_id }}</p>
                <v-select
                  v-else
                  v-model="getDockItem(dock.dock_id).receiver_dock_id"
                  :items="docks_receivers"
                  item-title="dock_id"
                  item-value="dock_id"
                  label="Select Dock Type"
                  hide-details
                  density="compact"
                  variant="underlined"/>
              </td>
              <td>
                <v-btn v-if="!dock.item_id"  density="comfortable" rounded="xl" size="small" color="success" block icon="mdi-plus" @click="addDockItem(dock.dock_id)" />
                <v-btn v-else density="comfortable" rounded="xl" size="small" color="error" block icon="mdi-minus" @click="deleteDockItem(dock.dock_id)"/>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </v-col>
    <Snackbar ref="snackbar" />
    <LoadingScreen v-model="loading" />
  </v-container>
</template>

<script setup lang="ts">
import MapViewer from '~/components/MapViewer.vue'
import CameraFeedCard from '~/components/CameraFeedCard.vue'
import { bareFrame, composePose2D, tfToPose2D, type Pose2D } from '~/utils/dockMarkers'
import { gridFromMessage, type MapDockMarker, type MapLayers, type RobotMeta } from '~/utils/mapRenderer'

  const dockStore = useDockStore()
  const selectedRobotsToLaunch = ref<string[]>([])
  const selectedRobotToDock = ref(null)
  const selectedDockConfig = ref<number | null>(null)
  const selectedDockId = ref(null)
  const toLaunchRobotHeaders = ['Robot Name', 'Namespace', 'IP Address', 'ROS ID', 'Battery','Status', 'Select']
  const toDockRobotHeaders = ['Robot Name', 'Namespace', 'IP Address', 'ROS ID', 'Battery','Status', 'Select', 'Stop']
  const dockHeaders = ['Dock ID', 'Dock Type', 'Status', 'Robot Assigned', 'Item ID', 'Weight', 'Receiver Dock', 'Actions']
  const dockConfigs = computed(() => dockStore.dockConfigs)
  const toLaunchRobots = computed(() => dockStore.toLaunchRobots)
  const toDockRobots = computed(() => dockStore.toDockRobots)
  const docks = computed(() => dockStore.docks)
  const dock_pickups = computed(() => dockStore.docks_pickups)
  const docks_receivers = computed(() => dockStore.docks_receivers)
  const rosConnections = new Map<string, any>()
  const snackbar = ref<any>(null)
  const loading = ref(false)

  async function refresh() {
    loading.value = true
    await dockStore.fetchDockConfigs()
    await dockStore.fetchOnlineRobotsWS()
    loading.value = false
  }

  async function launchRobots() {
    try {
      loading.value = true
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
      loading.value = false
      snackbar?.value.showSnackbar("Navigation launched successfully", "success")
    } catch (error) {
      loading.value = false
      snackbar?.value.showSnackbar(error, "error")
    }

  }

  async function dockRobot() {
    try {
      loading.value = true
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
      // console.log(result)
      loading.value = false
      snackbar?.value.showSnackbar(result.message, "success")
    } catch (error) {
      loading.value = false
      snackbar?.value.showSnackbar(error, "error")
    }
  }

  async function stopRobot(robotIp: string){
    try {
      loading.value = true
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
        loading.value = false

        clearCostmaps()
        snackbar?.value.showSnackbar(res.message, "success")
      } else {
        throw new Error(res.message || "Failed to stop the robot.")
      }
    } catch (error) {
      snackbar?.value.showSnackbar(error, "error")
    } finally {
      loading.value = false
    }
  }

  async function activateConfig(){
    const activeConfig = dockStore.dockConfigs.find(config => config.id === selectedDockConfig.value)
    if (!activeConfig) {
      snackbar?.value.showSnackbar("Selected dock configuration not found. Please select a valid configuration to activate.", "error")
      return
    }
    if (!selectedDockConfig.value){
      snackbar?.value.showSnackbar("Please select a dock configuration to activate.", "error")
      return
    }
    try {
      loading.value = true
      await dockStore.activateDockConfig(selectedDockConfig.value)
      await dockStore.fetchDockConfigs()
      const activeConfig = dockStore.dockConfigs.find(config => config.is_active)
      if (activeConfig) {
        selectedDockConfig.value = activeConfig.id
        activateButton.value = false
      }else {
        console.warn("No active dock configuration found. Please select a configuration to proceed.")
        activateButton.value = true
      }
    } catch (error) {
      snackbar?.value.showSnackbar(error, "error")
    } finally {
      loading.value = false
    }
  }

  async function deactivateConfig(){
    loading.value = true
    const activatedConfig = dockStore.dockConfigs.find(config => config.id === selectedDockConfig.value && config.is_active)
    if (!activatedConfig) {
      snackbar?.value.showSnackbar("Selected dock configuration not found or not active. Please select a valid configuration to deactivate.", "error")
      return
    }
    await dockStore.dockClear()
    selectedDockConfig.value = null
    await dockStore.fetchDockConfigs()
    activateButton.value = true
    loading.value = false
  }

  const activateButton = ref(false)
  const streamImageURL = ref('')
  onMounted(async () => {
    try{
      streamImageURL.value = `${window.location.protocol}//${window.location.hostname}`;
      loading.value = true
      await dockStore.fetchDockConfigs()
      await dockStore.fetchOnlineRobotsWS()
      const activeConfig = dockStore.dockConfigs.find(config => config.is_active)
      if (activeConfig) {
        selectedDockConfig.value = activeConfig.id
        activateButton.value = false
      }else {
        console.warn("No active dock configuration found. Please select a configuration to proceed.")
        activateButton.value = true
      }
    } catch (error) {
      // console.error("Error fetching dock configs or online robots:", error)
      snackbar?.value.showSnackbar(error, "error")
    } finally {
      loading.value = false
    }
  })

  watch(() => dockStore.onlineRobots,
    (robots) => {
      // console.log("Received robots update in navigation:", robots)
      const ROSLIB = (window as any).ROSLIB

      // Current online robot IPs
      const activeIps = new Set(robots.map(robot => robot.ip))

      // Disconnect robots that are no longer online
      for (const [ip, ros] of rosConnections.entries()) {
        if (!activeIps.has(ip)) {
          console.log(`Robot ${ip} is offline. Closing ROS connection...`)
          try {
            ros.close()
          } catch (err) {
            console.error(err)
          }
          rosConnections.delete(ip)
        }
      }

      robots.forEach(robot => {
        if (rosConnections.has(robot.ip)) {
          console.log(
            // `Already connected to ROS bridge on ${robot.hostname} at ${robot.ip}`
          )
          return
        }
        const ros = new ROSLIB.Ros({
          url: `ws://${robot.ip}:9090`
        })
        rosConnections.set(robot.ip, ros)
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
    },
    { deep: true }
  )

  const { startRefresh, stopRefresh } = usePolling(()=> {
    return new Promise<void>(async (resolve) => {
      await refreshDocks()
      resolve()
    })
  }, 1000)

  onUnmounted(() => {
    console.log("Closing ROS connections...")
    rosConnections.forEach((ros) => ros.close())
    stopRefresh()
  })

  watch (selectedDockConfig, async (newConfigId) => {
    await dockStore.fetchDocksAll(newConfigId)
    stopRefresh()
    console.log("Selected dock config ID:", newConfigId)
    selectedDockId.value = null
    selectedRobotToDock.value = null
    selectedRobotsToLaunch.value = []
    if (newConfigId) {
      try{
        const response = await fetch(`/api/selected-config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ configID: newConfigId })
        })
        // await Promise.reject(new Error("Simulated fetch error"))
        loading.value = true
        startRefresh()
      } catch (error) {
        snackbar?.value.showSnackbar(error, "error")
      } finally {
        loading.value = false
      }
    }else {
      await fetch('/api/selected-config', {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ configID: null })
      })
    }
  })

  async function refreshDocks() {
      try {
        // loading.value = true
        await dockStore.fetchDocks()
        // snackbar?.value.showSnackbar("Dock states refreshed successfully", "success")
      } catch (error) {
        snackbar?.value.showSnackbar(error, "error")
      } finally {
        // loading.value = false
      }
  }

  type DockItem = {
    dock_id: string
    receiver_dock_id: string
    item_id: string
    item_weight: number
  }
  const addedDockItem: Record<string, DockItem> = {}
  function getDockItem(dockId: string): DockItem {
    if (!addedDockItem[dockId]) {
      addedDockItem[dockId] = {
        dock_id: dockId,
        receiver_dock_id: '',
        item_id: '',
        item_weight: 0
      }
    }
    return addedDockItem[dockId]
  }

  async function addDockItem(dockId: string) {
    try {
      loading.value = true
      const receiverDockId = getDockItem(dockId).receiver_dock_id
      const itemId = getDockItem(dockId).item_id
      const weight = getDockItem(dockId).item_weight
      await dockStore.addDockItem(dockId, receiverDockId, itemId, weight)
      snackbar?.value.showSnackbar("Item added to dock successfully", "success")
    } catch (error) {
      snackbar?.value.showSnackbar(error, "error")
    } finally {
      loading.value = false
    }
  }

  async function deleteDockItem(dockId: string) {
    try {
      loading.value = true
      await dockStore.deleteDockItem(dockId)
      delete addedDockItem[dockId]
      snackbar?.value.showSnackbar("Item removed from dock successfully", "success")
    } catch (error) {
      snackbar?.value.showSnackbar(error, "error")
    } finally {
      loading.value = false
    }
  }

  // ===========================================================================
  // Live map: map from the first running robot, every robot's pose and Nav2 plan,
  // configured docks with their states, and the selected robot's costmaps
  // ===========================================================================
  const mapViewer = ref<InstanceType<typeof MapViewer> | null>(null)
  const mapLayers = reactive<MapLayers>({ globalCostmap: true, localCostmap: true, paths: true, labels: true })
  const LAYER_TOGGLES: { key: keyof MapLayers; label: string; color: string }[] = [
    { key: "globalCostmap", label: "Global costmap", color: "#6741d9" },
    { key: "localCostmap", label: "Local costmap", color: "#e67700" },
    { key: "paths", label: "Paths", color: "#16202b" },
    { key: "labels", label: "Labels", color: "#8a96a3" },
  ]
  const DOCK_LETTER: Record<string, string> = { pickup: "P", receiver: "R", waiting_zone: "W", hand_off: "H" }
  const DOCK_TYPE_NAME: Record<string, string> = { pickup: "Pickup", receiver: "Receiver", waiting_zone: "Waiting zone", hand_off: "Hand-off" }

  let rosMapConnection: any = null
  let mapProviderIp: string | null = null

  // one rosbridge connection per running robot, for its TF and Nav2 plan
  const robotLinks = new Map<string, any>()
  // per robot IP: map -> odom (AMCL) and odom -> base_footprint (odometry), as 2D poses incl. yaw
  const mapOdom: Record<string, Pose2D> = {}
  const odomBase: Record<string, Pose2D> = {}

  let costmapConnection: any = null

  const colorDict: Record<string, number[]> = {
    couliglig_bot_1: [255, 0, 0],    // red
    couliglig_bot_2: [0, 150, 255],  // blue
    couliglig_bot_3: [0, 200, 100],  // green
    couliglig_bot_4: [255, 150, 0],  // orange
    couliglig_bot_5: [200, 0, 255],  // purple
    couliglig_bot_6: [255, 50, 120], // pink
  }

  // Same colour for a namespace everywhere (marker, path, legend) and on every render:
  // known namespaces use colorDict, others get a hue derived from the name.
  function robotColor(namespace: string): string {
    let rgb = colorDict[namespace]
    if (!rgb) {
      let hash = 0
      for (let i = 0; i < namespace.length; i++) hash = (hash * 31 + namespace.charCodeAt(i)) >>> 0
      rgb = hslToRgb(hash % 360, 0.7, 0.5)
    }
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
  }

  function hslToRgb(h: number, s: number, l: number): number[] {
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
    }
    return [f(0), f(8), f(4)]
  }

  const shortName = (namespace: string) => namespace.replace(/^couliglig_/, "")

  const mapRobots = computed<RobotMeta[]>(() =>
    toDockRobots.value.map((robot) => ({
      id: robot.ip,
      color: robotColor(robot.namespace),
      label: robot.status ? `${shortName(robot.namespace)} · ${robot.status}` : shortName(robot.namespace),
      showPath: robot.status.toLowerCase().startsWith("navigating"),
    }))
  )

  const dockStates = computed(() => {
    const states = new Map<string, any>()
    ;[...dock_pickups.value, ...docks_receivers.value].forEach((state: any) => states.set(state.dock_id, state))
    return states
  })

  const mapDocks = computed<MapDockMarker[]>(() =>
    docks.value.map((dock: any) => {
      const state = dockStates.value.get(dock.dock_id)
      const occupant = state?.status === "occupied" && state.robot_id
        ? toDockRobots.value.find(robot => robot.namespace === state.robot_id || robot.hostname === state.robot_id)
        : undefined
      const notes = [state?.item_id, state?.status === "reserved" ? "reserved" : ""].filter(Boolean)
      return {
        id: dock.dock_id,
        x: dock.x,
        y: dock.y,
        theta: dock.theta,
        shape: "tile",
        badge: DOCK_LETTER[dock.dock_type] ?? "?",
        label: [dock.dock_id, ...notes].join(" · "),
        fill: occupant ? robotColor(occupant.namespace) : null,
        hasItem: !!state?.item_id,
      }
    })
  )

  // what the chip on the map says about the current selection
  const mapInfo = computed(() => {
    if (selectedDockId.value) {
      const dock: any = docks.value.find((d: any) => d.dock_id === selectedDockId.value)
      const state = dockStates.value.get(selectedDockId.value)
      return {
        title: selectedDockId.value,
        lines: [
          `${DOCK_TYPE_NAME[dock?.dock_type] ?? dock?.dock_type ?? ""} · ArUco ${dock?.aruco_id ?? "?"}`,
          [state?.status, state?.robot_id, state?.item_id].filter(Boolean).join(" · ") || "No state",
        ],
      }
    }
    const robot = toDockRobots.value.find(r => r.ip === selectedRobotToDock.value)
    if (robot) return { title: robot.namespace, lines: [`${robot.status || "unknown"} · battery ${robot.battery}%`] }
    const n = toDockRobots.value.length
    return { title: `${n} robot${n === 1 ? "" : "s"} running`, lines: ["Click a ready robot or a dock"] }
  })

  function onMapSelectRobot(ip: string) {
    const robot = toDockRobots.value.find(r => r.ip === ip)
    if (!robot) return
    if (robot.status.toUpperCase() !== "READY") {
      snackbar.value?.showSnackbar(`${robot.namespace} is ${robot.status || "busy"}; only READY robots can be docked`, "warning")
      return
    }
    selectedRobotToDock.value = ip as any
  }

  function onMapSelectDock(dockId: string) {
    selectedDockId.value = dockId as any
  }

  // camera of the selected robot, beside the map
  const CAMERA_COLLAPSED_KEY = "navigation-camera-collapsed"
  const cameraCollapsed = ref(false)
  const selectedNamespace = computed(() => toDockRobots.value.find(r => r.ip === selectedRobotToDock.value)?.namespace ?? null)
  const cameraSrc = computed(() =>
    streamImageURL.value && selectedNamespace.value ? `${streamImageURL.value}:8889/${selectedNamespace.value}` : null
  )
  function setCameraCollapsed(value: boolean) {
    cameraCollapsed.value = value
    try { localStorage.setItem(CAMERA_COLLAPSED_KEY, value ? "1" : "0") } catch (err) { console.warn("Could not save camera state:", err) }
  }
  onMounted(() => {
    try { cameraCollapsed.value = localStorage.getItem(CAMERA_COLLAPSED_KEY) === "1" } catch (err) { console.warn("Could not read camera state:", err) }
  })

  function closeRobotLink(ip: string) {
    try { robotLinks.get(ip)?.close() } catch (err) { console.error(err) }
    robotLinks.delete(ip)
    delete mapOdom[ip]
    delete odomBase[ip]
    mapViewer.value?.setPath(ip, null)
  }

  function closeMapConnections() {
    rosMapConnection?.close()
    rosMapConnection = null
    mapProviderIp = null
    for (const ip of [...robotLinks.keys()]) closeRobotLink(ip)
    clearCostmaps()
  }

  watch(toDockRobots, (robots) => {
    const ROSLIB = (window as any).ROSLIB

    if (robots.length === 0) {
      closeMapConnections()
      mapViewer.value?.clear()
      return
    }

    // close links of robots that stopped running (looked up by IP, so closing several at once is safe)
    const activeIps = new Set(robots.map(robot => robot.ip))
    for (const ip of [...robotLinks.keys()]) {
      if (!activeIps.has(ip)) closeRobotLink(ip)
    }

    initMap(ROSLIB, robots[0])
    robots.forEach(robot => connectRobot(ROSLIB, robot))
  })

  onUnmounted(() => closeMapConnections())

  function initMap(ROSLIB: any, mapRobot: any) {
    // If already connected to this robot, do nothing
    if (mapProviderIp === mapRobot.ip) return

    rosMapConnection?.close()
    mapProviderIp = mapRobot.ip
    const ros = new ROSLIB.Ros({ url: `ws://${mapRobot.ip}:9090` })
    rosMapConnection = ros

    ros.on("connection", () => {
      console.log(`Connected to ROS bridge on ${mapRobot.hostname} at ${mapRobot.ip} for map visualization.`)
      // the navigation map is static: take one message
      const mapTopic = new ROSLIB.Topic({ ros, name: "/map", messageType: "nav_msgs/msg/OccupancyGrid" })
      mapTopic.subscribe((msg: any) => {
        mapTopic.unsubscribe()
        if (rosMapConnection !== ros) return
        mapViewer.value?.setGrid(gridFromMessage(msg))
      })
    })
  }

  function connectRobot(ROSLIB: any, robot: any) {
    // If already connected to this robot, do nothing
    if (robotLinks.has(robot.ip)) return

    const ros = new ROSLIB.Ros({ url: `ws://${robot.ip}:9090` })
    robotLinks.set(robot.ip, ros)

    ros.on("connection", () => {
      const tfTopic = new ROSLIB.Topic({ ros, name: `/${robot.namespace}/tf`, messageType: "tf2_msgs/msg/TFMessage" })
      tfTopic.subscribe((msg: any) => {
        let updated = false
        msg.transforms.forEach((t: any) => {
          // frames may be namespaced ('couliglig_bot_1/odom')
          const parent = bareFrame(t.header?.frame_id)
          const child = bareFrame(t.child_frame_id)
          if (parent === "map" && child === "odom") {
            mapOdom[robot.ip] = tfToPose2D(t)
            updated = true
          } else if (parent === "odom" && child === "base_footprint") {
            odomBase[robot.ip] = tfToPose2D(t)
            updated = true
          }
        })
        if (!updated || !mapOdom[robot.ip] || !odomBase[robot.ip]) return
        // map -> base = (map -> odom) ∘ (odom -> base); the rotation of map -> odom matters
        // whenever AMCL's pose isn't aligned with odom (e.g. a robot that started turned)
        mapViewer.value?.setRobotPose(robot.ip, composePose2D(mapOdom[robot.ip], odomBase[robot.ip]))
      })

      // Nav2's global plan, in the map frame
      const planTopic = new ROSLIB.Topic({ ros, name: `/${robot.namespace}/plan`, messageType: "nav_msgs/msg/Path", throttle_rate: 500 })
      planTopic.subscribe((msg: any) => {
        if (bareFrame(msg.header?.frame_id) !== "map") return
        const poses = msg.poses ?? []
        const step = Math.max(1, Math.floor(poses.length / 300))
        const points: [number, number][] = []
        for (let i = 0; i < poses.length; i += step) points.push([poses[i].pose.position.x, poses[i].pose.position.y])
        if (poses.length) {
          const last = poses[poses.length - 1].pose.position
          points.push([last.x, last.y])
        }
        mapViewer.value?.setPath(robot.ip, points)
      })
    })
  }

  // costmaps of the robot picked for docking
  watch(selectedRobotToDock, (newIp: string | null) => {
    console.log("Selected robot to dock:", newIp)
    clearCostmaps()
    if (!newIp) return

    const robot_namespace = toDockRobots.value.find(robot => robot.ip === newIp)?.namespace
    if (!robot_namespace) {
      console.error(`Could not find robot with IP ${newIp} in toDockRobots`)
      return
    }

    const ROSLIB = (window as any).ROSLIB
    const ros = new ROSLIB.Ros({ url: `ws://${newIp}:9090` })
    costmapConnection = ros

    ros.on("connection", () => {
      console.log(`Connected to ROS bridge on ${robot_namespace} at ${newIp} for costmap visualization.`)
      for (const kind of ["local", "global"] as const) {
        const topic = new ROSLIB.Topic({
          ros,
          name: `/${robot_namespace}/${kind}_costmap/costmap`,
          messageType: "nav_msgs/msg/OccupancyGrid",
        })
        topic.subscribe((msg: any) => {
          if (costmapConnection !== ros) return
          const origin = costmapOriginInMap(msg, newIp)
          // a local costmap (odom frame) waits until map -> odom is known
          if (origin) mapViewer.value?.setCostmap(kind, { ...gridFromMessage(msg), origin })
        })
      }
    })
  })

  // Origin of a costmap in the map frame, from the frame its OccupancyGrid header names:
  // 'map' as is, 'odom' through this robot's map -> odom (rotation included).
  function costmapOriginInMap(msg: any, robotIp: string): Pose2D | null {
    const originInFrame = gridFromMessage(msg).origin
    const frame = bareFrame(msg.header?.frame_id)
    if (frame === "map") return originInFrame
    if (frame === "odom") {
      const mo = mapOdom[robotIp]
      return mo ? composePose2D(mo, originInFrame) : null
    }
    console.warn(`Costmap in unsupported frame '${msg.header?.frame_id}', not drawn`)
    return null
  }

  function clearCostmaps() {
    costmapConnection?.close()
    costmapConnection = null
    mapViewer.value?.setCostmap("local", null)
    mapViewer.value?.setCostmap("global", null)
  }

  function usePolling(fn: () => Promise<void>, delay = 5000) {
    let stopped = false

    const run = async () => {
        if (stopped) return

        await fn()

        setTimeout(run, delay)
    }

    const startRefresh = () => {
        stopped = false
        run()
    }

    const stopRefresh = () => {
        stopped = true
    }

    return { startRefresh, stopRefresh }
  }

  async function goToInitialPose() {
    try {
      loading.value = true
      if (!selectedRobotToDock.value || !selectedDockConfig.value) {
        throw new Error("Please select a robot, dock configuration, and dock to proceed with docking.")
      }

      const selectedRobot = toDockRobots.value.find(robot => robot.ip === selectedRobotToDock.value)
      if (!selectedRobot) {
        throw new Error(`Selected robot with IP ${selectedRobotToDock.value} not found in navigating robots.`)
      }

      const formData = new FormData();
      formData.append("dock_id", 'initial_pose');
      const response = await fetch(`http://${selectedRobot.ip}:8000/roslib/dock`, {
          method: "POST",
          body: formData
      });

      const result = await response.json();
      // console.log(result)
      loading.value = false
      snackbar?.value.showSnackbar(result.message, "success")
    } catch (error) {
      loading.value = false
      snackbar?.value.showSnackbar(error, "error")
    }
  }

</script>

<style scoped>
  /* layer toggles above the map; colours match the map palette in MapViewer.vue */
  .layer-toggles { display: flex; flex-wrap: wrap; gap: 6px; }
  .layer-toggles button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: normal;
    border: 1px solid #d6dce3;
    background: #fff;
    color: #5b6876;
    border-radius: 999px;
    padding: 3px 11px 3px 9px;
    cursor: pointer;
  }
  .layer-toggles button i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .layer-toggles button[aria-pressed="true"] { color: #16202b; border-color: #16202b; }
  .layer-toggles button[aria-pressed="false"] i { opacity: 0.3; }
  .layer-toggles button:focus-visible { outline: 2px solid #e8590c; outline-offset: 2px; }

  /* chips on the map (MapViewer slots) */
  .map-info-line { color: #5b6876; }
  .map-legend { display: grid; grid-template-columns: auto auto; gap: 3px 8px; align-items: center; }
  .sw { width: 12px; height: 12px; justify-self: center; }
  .sw.robot { border-radius: 50%; }
</style>