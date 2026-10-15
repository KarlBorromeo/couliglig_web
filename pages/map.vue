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
      <v-col cols="12" :lg="showDockPanel ? 7 : 12">
        <v-card elevation="3">
          <v-card-title ><v-icon size="20">mdi-map-outline</v-icon> Live Map Render</v-card-title>
          <v-card-text>
            <div class="d-flex align-center justify-center" style="height: 700px; background-color: #f5f5f5; border: 1px solid #ddd; overflow: auto;">
              <span v-if="!selectedRobot" class="text-center" style="color: #888;">Select a robot to view its map</span>
              <span id="map"/>
            </div>
            <p class="mt-2 text-caption">
              <span style="color: rgb(255, 0, 0);">&#9650;</span> robot ·
              <span style="color: rgb(25, 118, 210);">&#9650;</span> dock ·
              <span style="color: rgb(158, 158, 158);">&#9650;</span> skipped ·
              <span style="color: rgb(255, 193, 7);">&#9650;</span> selected
            </p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col v-if="showDockPanel" cols="12" lg="5">
        <DetectedDocksPanel
          :docks="detectedDocks"
          :edits="dockEdits"
          :selected-id="selectedDockId"
          :mapping="isSelectedRobotMapping()"
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
import {
  DockMarkerLayer,
  bareFrame,
  composePose2D,
  nextDockId,
  sanitizeDockEdits,
  tfToPose2D,
  type DetectedDock,
  type DockEdit,
  type DockEdits,
  type FinishMappingDock,
  type Pose2D
} from '~/utils/dockMarkers'

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

  // map overlay state, hoisted out of the ROS connection callback
  let viewer: any = null
  let dockLayer: DockMarkerLayer | null = null
  let docksTopic: any = null
  let mapToOdom: Pose2D | null = null
  let odomToBase: Pose2D | null = null

  const selectedRobotInfo = computed(() =>
    activeRobots.value.find(r => r.ip === selectedRobot.value)
      ?? dockStore.onlineRobots.find(r => r.ip === selectedRobot.value)
      ?? null
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
    redrawDockMarkers()
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

  // name / skip / selection changes are reflected on the map immediately
  watch([dockEdits, selectedDockId], () => redrawDockMarkers(), { deep: true })

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
    redrawDockMarkers()

    if (newIds.length) {
      snackbar.value?.showSnackbar(`Dock detected: ArUco ${newIds.join(", ")}`, "success")
    }
  }

  function redrawDockMarkers() {
    dockLayer?.sync(detectedDocks.value, dockEdits.value, selectedDockId.value, viewer?.scene?.scaleX)
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
    if (docksTopic) {
      try { docksTopic.unsubscribe() } catch (err) { console.error(err) }
      docksTopic = null
    }
    dockLayer?.destroy()
    dockLayer = null
    if (viewer) {
      try {
        // ROS2D.Viewer registers its stage on the global Ticker; unregister it
        (window as any).createjs?.Ticker.removeEventListener("tick", viewer.scene)
        viewer.scene.removeAllChildren()
      } catch (err) {
        console.error(err)
      }
      viewer = null
    }
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
    const ROS2D = (window as any).ROS2D
    const createjs = (window as any).createjs

    const thisRos = new ROSLIB.Ros({
      url: `ws://${robot.ip}:9090`
    })
    ros.value = thisRos

    ros.value.on("connection", () => {
      // ignore late connections from a robot that is no longer selected
      if (ros.value !== thisRos) return

      const mapContainer = document.getElementById("map")
      if (mapContainer) mapContainer.innerHTML = ""

      const thisViewer = new ROS2D.Viewer({
        divID: "map",
        width: 700,
        height: 700
      })
      viewer = thisViewer

      const gridClient = new ROS2D.OccupancyGridClient({
        ros: ros.value,
        rootObject: thisViewer.scene,
        topic: "/map",
        continuous: true
      })

      gridClient.on("change", () => {
        const grid = gridClient.currentGrid
        if (!grid) return

        thisViewer.scaleToDimensions(grid.width, grid.height)
        thisViewer.shift(grid.pose.position.x, grid.pose.position.y)
        // keep dock labels a constant on-screen size after rescaling
        redrawDockMarkers()

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

      dockLayer = new DockMarkerLayer(selectDock)
      thisViewer.scene.addChild(dockLayer.container)
      thisViewer.scene.addChild(robotMarker)

      docksTopic = new ROSLIB.Topic({
        ros: ros.value,
        name: `/${robot.namespace}/detected_docks`,
        messageType: "custom_msgs/msg/DetectedDockArray"
      })
      docksTopic.subscribe(onDetectedDocks)

      const tfTopic = new ROSLIB.Topic({
        ros: ros.value,
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
        robotMarker.x = pose.x
        robotMarker.y = -pose.y
        robotMarker.rotation = -pose.yaw * 180 / Math.PI
      })
    })
  })
</script>