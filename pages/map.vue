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
        <v-btn :disabled="!selectedRobot || !isSelectedRobotMapping()" variant="outlined" prepend-icon="mdi-download" @click="saveMap">Download Map</v-btn>
        <v-btn :disabled="!selectedRobot || !isSelectedRobotMapping()" elevation="2" color="success" prepend-icon="mdi-check" @click="finishDialog = true">Finish Mapping</v-btn>
      </section>
      <p class="mt-2 text-caption" >{{ statusText }}</p>
    </v-col>

    <v-row>
      <v-col cols="12" :lg="selectedRobot ? 7 : 12">
        <v-card elevation="3">
          <v-card-title class="d-flex align-center">
            <v-icon size="20">mdi-map-outline</v-icon>
            <span class="ml-1">Live Map</span>
          </v-card-title>
          <v-card-text>
            <MapViewer
              ref="mapViewer"
              height="min(72vh, 720px)"
              :empty-text="selectedRobot ? 'Waiting for /map from the robot…' : 'Select a robot to view its map'"
              :robots="mapRobots"
              :docks="mapDocks"
              :selected-dock-id="selectedDockId !== null ? String(selectedDockId) : null"
              :follow-robot-id="mapRobots.length ? MAP_ROBOT_ID : null"
              :trail-robot-id="mapRobots.length ? MAP_ROBOT_ID : null"
              @select-dock="id => selectDock(Number(id))"
            >
              <template #status="{ stats }">
                <div class="map-status-row">
                  <span class="live-dot" :class="{ idle: !isSelectedRobotMapping() }" />
                  <strong>{{ isSelectedRobotMapping() ? 'Mapping' : 'Not mapping' }}</strong>
                </div>
                <div class="map-status-num">
                  {{ stats.freeArea.toFixed(0) }} m² explored · {{ detectedDocks.length }} dock{{ detectedDocks.length === 1 ? '' : 's' }}
                </div>
              </template>
              <template #legend>
                <div class="map-legend">
                  <span class="sw robot" /><span>Robot</span>
                  <span class="sw dock" /><span>Dock, ring shows how settled</span>
                  <span class="sw dock skipped" /><span>Skipped</span>
                  <span class="sw wall" /><span>Wall</span>
                  <span class="sw unknown" /><span>Not seen yet</span>
                </div>
              </template>
            </MapViewer>
            <p class="mt-2 text-caption text-medium-emphasis">
              Scroll to zoom, drag to pan. Click a dock to select it in the list.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col v-if="selectedRobot" cols="12" lg="5" class="d-flex flex-column ga-4">
        <CameraFeedCard
          :src="cameraStreamURL"
          :label="selectedRobotInfo?.namespace"
          :collapsed="cameraCollapsed"
          @update:collapsed="setCameraCollapsed"
        />
        <DetectedDocksPanel
          v-if="showDockPanel"
          :docks="detectedDocks"
          :edits="dockEdits"
          :selected-id="selectedDockId"
          :mapping="isSelectedRobotMapping()"
          :max-height="cameraCollapsed ? '720px' : '440px'"
          @update="updateDockEdit"
          @select="selectDock"
        />
      </v-col>
    </v-row>
    <FinishMappingDialog
      ref="finishDialogRef"
      v-model="finishDialog"
      :docks="finishDocks"
      @submit="finishMapping"
    />
    <Snackbar ref="snackbar" />
    <LoadingScreen v-model="loading" :text="loadingText" />
  </v-container>
</template>

<script setup lang="ts">
import Snackbar from '~/components/snackbar.vue'
import DetectedDocksPanel from '~/components/DetectedDocksPanel.vue'
import FinishMappingDialog from '~/components/FinishMappingDialog.vue'
import CameraFeedCard from '~/components/CameraFeedCard.vue'
import MapViewer from '~/components/MapViewer.vue'
import {
  bareFrame,
  composePose2D,
  dockFixLevel,
  nextDockId,
  sanitizeDockEdits,
  tfToPose2D,
  type DetectedDock,
  type DockEdit,
  type DockEdits,
  type FinishMappingDock,
  type Pose2D
} from '~/utils/dockMarkers'
import { gridFromMessage, type MapDockMarker, type RobotMeta } from '~/utils/mapRenderer'

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
  const activeRobots = computed(() => dockStore.toMappingRobots)
  let selectedRobot = ref<string | null>(null)
  // const rosConnections: any[] = []
  const rosConnections = new Map<string, any>()
  const loading = ref(true)

  async function toggleRequestMapping(robotIp: string, command: string) {
    try{
      loading.value = true
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
      return true
    } catch (error) {
      snackbar?.value.showSnackbar(error, "error")
      return false
    } finally {
      loading.value = false
    }
  }

  async function saveMap() {
      try {
          loading.value = true
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

          loading.value = false
          snackbar?.value.showSnackbar("✅ Map saved and downloaded successfully.", "success");

      } catch (err) {
          loading.value = false
          snackbar?.value.showSnackbar("❌ Failed to save map.", "error");
      }
  }
  
  async function refreshRobots() {
    loading.value = true
    await dockStore.fetchOnlineRobotsWS()
    loading.value = false
  }

  function isSelectedRobotMapping() {
    const robot = activeRobots.value.find(r => r.ip === selectedRobot.value)
    return robot?.status.toUpperCase() === "MAPPING"
  }

  function startRobotMapping() {
    const selectedRobotIp = selectedRobot.value? selectedRobot.value : ""
    if (!selectedRobotIp) return
    // a new SLAM session starts with a fresh dock draft
    clearDockDraft()
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
    streamHost.value = `${window.location.protocol}//${window.location.hostname}`
    try {
      cameraCollapsed.value = localStorage.getItem(CAMERA_COLLAPSED_KEY) === "1"
    } catch (err) {
      console.warn("Could not read camera state:", err)
    }
    try{
      loading.value = true
      // await Promise.reject(new Error("Simulated fetch error"))
      await dockStore.fetchOnlineRobotsWS()
      loading.value = false
    } catch (error) {
      loading.value = false
      // console.error("Error fetching dock configs or online robots:", error)
      snackbar?.value.showSnackbar(error, "error")
    }
  })

  watch(() => dockStore.onlineRobots,
    (robots) => {
      console.log("Received robots update in map:", robots)
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
            `Already connected to ROS bridge on ${robot.hostname} at ${robot.ip}`
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

  onUnmounted(() => {
    console.log("Closing ROS connections...")
    rosConnections.forEach((ros) => ros.close())
    teardownMapView()
    if (ros.value) ros.value.close()
  })
  
  // ---------------------------------------------------------------------------
  // Detected docks (live from /<ns>/detected_docks) + operator draft
  // ---------------------------------------------------------------------------
  const detectedDocks = ref<DetectedDock[]>([])
  const dockEdits = ref<DockEdits>({})
  const selectedDockId = ref<number | null>(null)
  const finishDialog = ref(false)
  const finishDialogRef = ref<InstanceType<typeof FinishMappingDialog> | null>(null)
  const loadingText = ref("")
  let draftHostname: string | null = null

  // map view state, hoisted out of the ROS connection callback
  const MAP_ROBOT_ID = "robot"
  const mapViewer = ref<InstanceType<typeof MapViewer> | null>(null)
  let mapTopic: any = null
  let tfTopic: any = null
  let docksTopic: any = null
  let mapToOdom: Pose2D | null = null
  let odomToBase: Pose2D | null = null

  const selectedRobotInfo = computed(() =>
    activeRobots.value.find(r => r.ip === selectedRobot.value)
      ?? dockStore.onlineRobots.find(r => r.ip === selectedRobot.value)
      ?? null
  )

  // MediaMTX WebRTC player for the robot's detector stream (same as dashboard/navigation)
  const streamHost = ref("")
  const cameraStreamURL = computed(() => {
    const ns = selectedRobotInfo.value?.namespace
    return streamHost.value && ns ? `${streamHost.value}:8889/${ns}` : null
  })

  const CAMERA_COLLAPSED_KEY = "mapping-camera-collapsed"
  const cameraCollapsed = ref(false)
  function setCameraCollapsed(value: boolean) {
    cameraCollapsed.value = value
    try {
      localStorage.setItem(CAMERA_COLLAPSED_KEY, value ? "1" : "0")
    } catch (err) {
      console.warn("Could not save camera state:", err)
    }
  }

  // the mapping robot, drawn in the map's accent colour with a trail
  const mapRobots = computed<RobotMeta[]>(() =>
    selectedRobotInfo.value ? [{ id: MAP_ROBOT_ID, color: "#e8590c" }] : []
  )

  // detected docks as map pins: ArUco id on the badge, settledness ring, operator's name as label
  const mapDocks = computed<MapDockMarker[]>(() =>
    detectedDocks.value.map((dock) => {
      const edit = dockEdits.value[dock.aruco_id]
      const skipped = edit?.ignored === true
      return {
        id: String(dock.aruco_id),
        x: dock.x,
        y: dock.y,
        theta: dock.theta,
        shape: "pin",
        badge: String(dock.aruco_id),
        label: skipped ? `${edit?.dock_id || "dock"} · skipped` : (edit?.dock_id || "dock"),
        level: dockFixLevel(dock),
        muted: skipped
      }
    })
  )

  const showDockPanel = computed(() => !!selectedRobot.value && (isSelectedRobotMapping() || detectedDocks.value.length > 0))

  // currently detected docks merged with their draft, for the finish dialog / payload
  const finishDocks = computed<FinishMappingDock[]>(() =>
    detectedDocks.value
      .filter(d => dockEdits.value[d.aruco_id])
      .map(d => ({ aruco_id: d.aruco_id, ...dockEdits.value[d.aruco_id] }))
  )

  function draftKey(hostname: string) {
    return `mapping-draft:${hostname}`
  }

  function loadDockDraft(hostname: string | undefined) {
    draftHostname = hostname ?? null
    let edits: DockEdits = {}
    if (draftHostname) {
      try {
        const raw = localStorage.getItem(draftKey(draftHostname))
        if (raw) edits = sanitizeDockEdits(JSON.parse(raw))
      } catch (err) {
        console.warn("Could not read mapping draft:", err)
      }
    }
    dockEdits.value = edits
  }

  function clearDockDraft() {
    dockEdits.value = {}
    detectedDocks.value = []
    selectedDockId.value = null
    if (!draftHostname) return
    try {
      localStorage.removeItem(draftKey(draftHostname))
    } catch (err) {
      console.warn("Could not clear mapping draft:", err)
    }
  }

  watch(dockEdits, (edits) => {
    if (!draftHostname) return
    try {
      if (Object.keys(edits).length === 0) localStorage.removeItem(draftKey(draftHostname))
      else localStorage.setItem(draftKey(draftHostname), JSON.stringify(edits))
    } catch (err) {
      console.warn("Could not save mapping draft:", err)
    }
  }, { deep: true })

  function onDetectedDocks(msg: any) {
    const docks: DetectedDock[] = (msg?.docks ?? [])
      .map((d: any) => ({
        aruco_id: Number(d.aruco_id),
        x: Number(d.x),
        y: Number(d.y),
        theta: Number(d.theta),
        marker_yaw: Number(d.marker_yaw),
        observations: Number(d.observations),
        position_std: Number(d.position_std),
        last_seen: d.last_seen
      }))
      .sort((a: DetectedDock, b: DetectedDock) => a.aruco_id - b.aruco_id)

    const newIds: number[] = []
    docks.forEach((dock) => {
      if (dockEdits.value[dock.aruco_id]) return
      dockEdits.value[dock.aruco_id] = { dock_id: nextDockId(dockEdits.value), dock_type: null, ignored: false }
      newIds.push(dock.aruco_id)
    })

    detectedDocks.value = docks
    if (selectedDockId.value !== null && !docks.some(d => d.aruco_id === selectedDockId.value)) {
      selectedDockId.value = null
    }

    if (newIds.length) {
      snackbar.value?.showSnackbar(`Dock detected: ArUco ${newIds.join(", ")}`, "success")
    }
  }

  function updateDockEdit(arucoId: number, patch: Partial<DockEdit>) {
    const current = dockEdits.value[arucoId]
    if (!current) return
    dockEdits.value[arucoId] = { ...current, ...patch }
  }

  function selectDock(arucoId: number) {
    selectedDockId.value = arucoId
  }

  function teardownMapView() {
    for (const topic of [docksTopic, mapTopic, tfTopic]) {
      if (!topic) continue
      try { topic.unsubscribe() } catch (err) { console.error(err) }
    }
    docksTopic = mapTopic = tfTopic = null
    mapViewer.value?.clear()
    detectedDocks.value = []
    selectedDockId.value = null
    mapToOdom = null
    odomToBase = null
  }

  async function finishMapping(form: { name: string; description: string }) {
    const robot = selectedRobotInfo.value
    if (!robot) return
    const docks = finishDocks.value
      .filter(d => !d.ignored && d.dock_type)
      .map(d => ({ aruco_id: d.aruco_id, dock_id: d.dock_id.trim(), dock_type: d.dock_type as string }))

    loadingText.value = "Saving map and docks…"
    loading.value = true
    let saved
    try {
      // save BEFORE stopping: stopping SLAM kills the map we want to save
      saved = await dockStore.finishMapping({
        hostname: robot.hostname,
        name: form.name,
        description: form.description,
        docks
      })
    } catch (error: any) {
      // SLAM keeps running and the dialog keeps its data so the operator can retry
      loading.value = false
      loadingText.value = ""
      snackbar.value?.showSnackbar(error?.message ?? String(error), "error", 8000)
      return
    }

    finishDialog.value = false
    loadingText.value = "Stopping SLAM…"
    const stopped = await toggleRequestMapping(robot.ip, "stop")
    loading.value = false
    loadingText.value = ""
    clearDockDraft()
    finishDialogRef.value?.reset()

    let message = `Saved "${form.name}" with ${saved.docks_created} docks`
    if (saved.unreviewed?.length) message += ` · not reviewed: ArUco ${saved.unreviewed.join(", ")}`
    if (!stopped) {
      // saved, but SLAM is still running: stay here so the operator can stop it
      snackbar.value?.showSnackbar(`${message} · failed to stop SLAM, stop it manually`, "warning", 10000)
      return
    }
    snackbar.value?.showSnackbar(message, "success", 6000)
    // let the operator read the result before leaving the page (its snackbar unmounts on navigation)
    await new Promise(resolve => setTimeout(resolve, 1500))
    await navigateTo("/edit-config")
  }

  // shallowRef: a plain ref would wrap the ROSLIB.Ros in a reactive proxy,
  // so the `ros.value !== thisRos` guard below would always bail out
  const ros = shallowRef<any>(null)
  watch(selectedRobot, (robotIp) => {
    console.log("Selected robot IP:", robotIp)
    const robot = activeRobots.value.find(r => r.ip === robotIp)
    if (!robot) return

    // drop the previous robot's overlay/subscriptions, then load this robot's dock draft
    teardownMapView()
    loadDockDraft(robot.hostname)

    // close previous connection
    if (ros.value) {
      ros.value.close()
    }

    const ROSLIB = (window as any).ROSLIB

    const thisRos = new ROSLIB.Ros({
      url: `ws://${robot.ip}:9090`
    })
    ros.value = thisRos

    ros.value.on("connection", () => {
      // ignore late connections from a robot that is no longer selected
      if (ros.value !== thisRos) return

      // the map grows while SLAM runs, so keep the subscription open
      mapTopic = new ROSLIB.Topic({
        ros: thisRos,
        name: "/map",
        messageType: "nav_msgs/msg/OccupancyGrid"
      })
      mapTopic.subscribe((msg: any) => {
        if (ros.value !== thisRos) return
        mapViewer.value?.setGrid(gridFromMessage(msg))
      })

      docksTopic = new ROSLIB.Topic({
        ros: thisRos,
        name: `/${robot.namespace}/detected_docks`,
        messageType: "custom_msgs/msg/DetectedDockArray"
      })
      docksTopic.subscribe(onDetectedDocks)

      tfTopic = new ROSLIB.Topic({
        ros: thisRos,
        name: `/${robot.namespace}/tf`,
        messageType: "tf2_msgs/msg/TFMessage"
      })
      tfTopic.subscribe((msg:any) => {
        let updated = false
        msg.transforms.forEach((t:any) => {
          const child = bareFrame(t.child_frame_id)
          if (child === "odom" && bareFrame(t.header?.frame_id) === "map") {
            mapToOdom = tfToPose2D(t)
            updated = true
          } else if (child === "base_footprint") {
            odomToBase = tfToPose2D(t)
            updated = true
          }
        })
        if (!updated || !odomToBase) return

        // robot pose in map = (map -> odom) ∘ (odom -> base_footprint); identity until SLAM publishes map -> odom
        const pose = mapToOdom ? composePose2D(mapToOdom, odomToBase) : odomToBase
        mapViewer.value?.setRobotPose(MAP_ROBOT_ID, pose)
      })
    })
  })
</script>
<style scoped>
  /* chips on the map (MapViewer slots); colours match the map palette in MapViewer.vue */
  .map-status-row { display: flex; align-items: center; gap: 8px; }
  .map-status-num { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; color: #5b6876; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #e8590c; animation: live 1.6s infinite; }
  .live-dot.idle { background: #8a96a3; animation: none; }
  @keyframes live {
    0% { box-shadow: 0 0 0 0 rgba(232, 89, 12, 0.6); }
    100% { box-shadow: 0 0 0 8px rgba(232, 89, 12, 0); }
  }
  @media (prefers-reduced-motion: reduce) { .live-dot { animation: none; } }
  .map-legend { display: grid; grid-template-columns: auto auto; gap: 3px 8px; align-items: center; }
  .sw { width: 12px; height: 12px; border-radius: 3px; border: 1px solid #d6dce3; justify-self: center; }
  .sw.robot { border-radius: 50%; background: #e8590c; border-color: #e8590c; }
  .sw.dock { width: 10px; height: 10px; border-radius: 50%; background: #1c6fd1; border: 2px solid #fff; outline: 2px solid #1c6fd1; }
  .sw.dock.skipped { background: #8a96a3; outline-color: #8a96a3; }
  .sw.wall { background: #1e2a36; }
  .sw.unknown { background: #e3e8ee; }
</style>
