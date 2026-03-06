<template>
  <v-container class="d-flex flex-column ga-5">
    <section class="">
      <h1>Config Manager</h1>
      <p>This section allows you to create the configuration settings and files for the robots.</p>
    </section>
    <v-col>
      <v-file-input clearable label="Map Yaml" variant="outlined" accept=".yaml,.yml" v-model="mapYamlFile"></v-file-input>
      <v-file-input clearable label="Map Image" variant="outlined" accept=".pgm" v-model="mapImageFile"></v-file-input>
      <v-file-input clearable label="Dock Database" variant="outlined" accept=".yaml,.yml" v-model="dockYamlFile"></v-file-input>        
    </v-col>
    <v-col>
      <v-card elevation="3" class="pa-2">
        <v-card-title class="d-flex align-center">
          Dock Configurations
        </v-card-title>
        <v-table>
          <thead>
            <tr>
              <th>Dock ID</th>
              <th>Pose X</th>
              <th>Pose Y</th>
              <th>Pose Theta</th>
              <th>Aruco Marker ID</th>
              <th>Docking Type</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(dock, i) in docks" :key="i">
              <td><v-text-field density="compact" variant="underlined" hide-details v-model="dock.dock_id"></v-text-field></td>
              <td><v-text-field density="compact" variant="underlined" hide-details v-model="dock.x"></v-text-field></td>
              <td><v-text-field density="compact" variant="underlined" hide-details v-model="dock.y"></v-text-field></td>
              <td><v-text-field density="compact" variant="underlined" hide-details v-model="dock.theta"></v-text-field></td>
              <td><v-text-field density="compact" variant="underlined" hide-details v-model="dock.aruco_id"></v-text-field></td>
              <td>
                  <v-select
                    :items="dockingTypes"
                    v-model="dock.dock_type"
                    density="compact"
                    variant="underlined"
                    hide-details
                  ></v-select>
              </td>
            </tr>
          </tbody>
          <v-footer class="d-flex align-center">
            <v-btn variant="flat" prepend-icon="mdi-plus" size="x-small" @click="docks.push({config_id: undefined, dock_id: `dock_${docks.length}`, x: 0, y: 0, theta: 0, aruco_id: 0, dock_type: 'pickup' })">Add Dock</v-btn>
            <v-btn variant="flat" prepend-icon="mdi-minus" size="x-small" :disabled="docks.length === 0" @click="docks.pop()">Remove Dock</v-btn>
          </v-footer>
        </v-table>
      </v-card>
    </v-col>
    <v-col>
      <v-card elevation="3" class="pa-2">
        <v-card-title class="d-flex align-center">
          Robot Initial Poses
        </v-card-title>
        <v-table>
          <thead>
            <tr>
              <th>Select Robot</th>
              <th>Pose X</th>
              <th>Pose Y</th>
              <th>Pose Theta (radians)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for ="(robot, i) in robotPoses" :key="i">
              <td>
                <v-select
                  :items="robotNames"
                  variant="underlined"
                  hide-details
                  v-model="robot.robot_name"
                  density="compact"
                ></v-select>
              </td>
              <td><v-text-field density="compact" variant="underlined" hide-details v-model="robot.initial_x"></v-text-field></td>
              <td><v-text-field density="compact" variant="underlined" hide-details v-model="robot.initial_y"></v-text-field></td>
              <td><v-text-field density="compact" variant="underlined" hide-details v-model="robot.initial_theta"></v-text-field></td>
            </tr>
          </tbody>
          <v-footer class="d-flex align-center">
            <v-btn variant="flat" prepend-icon="mdi-plus" size="x-small" @click="robotPoses.push({ robot_name: '', initial_x: 0, initial_y: 0, initial_theta: 0 })">Add Robot</v-btn>
            <v-btn variant="flat" prepend-icon="mdi-minus" size="x-small" :disabled="robotPoses.length === 0" @click="robotPoses.pop()">Remove Robot</v-btn>
          </v-footer>
        </v-table>
      </v-card>
    </v-col>
    <v-col class="d-flex">
      <UploadModal class="flex-grow-1" @submit="handleSubmit"/>    
    </v-col>

  </v-container>
</template>

<script setup lang="ts">
  import YAML from "yaml";
  const dockStore = useDockStore();
  const dockYamlFile = ref<File | null>(null);
  const mapYamlFile = ref<File | null>(null);
  const mapImageFile = ref<File | null>(null);
  const listRobotNames = ['couliglig_bot_1', 'couliglig_bot_2', 'couliglig_bot_3', 'couliglig_bot_4', 'couliglig_bot_5', 'couliglig_bot_6', 'couliglig_bot_7', 'couliglig_bot_8', 'couliglig_bot_9', 'couliglig_bot_10']
  let robotNames = ref<string[]>([...listRobotNames])
  const dockingTypes = ['pickup', 'receiver', 'waiting_zone']

  interface Dock {
    config_id: number | undefined
    dock_id: string
    dock_type: string
    x: number
    y: number
    theta: number
    aruco_id: number
  }
  interface robotPose {
    robot_name: string
    initial_x: number
    initial_y: number
    initial_theta: number
  }
  const docks = ref<Dock[]>([])
  const robotPoses = ref<robotPose[]>([])

  watch(dockYamlFile, async (file: File | null) => {
    docks.value = [];
    if (!file) {
      return;
    }
    try {
      loadYaml(file)
    } catch (error) {
      console.error('Error reading file:', error)
    }
  })

  watch(robotPoses, (newVal) => {
    console.log("Updated Robot Poses:", newVal);
    const addedNames = newVal.map(robot => robot.robot_name).filter(name => name !== '');
    robotNames.value = listRobotNames.filter(name => !addedNames.includes(name));
  }, { deep: true })

  function loadYaml(file : File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target?.result;
      if (typeof text === "string") {
      try {
          const parsed = YAML.parse(text);
          const docksData = parsed.docks;
          for (const dockKey in docksData) {
            const dockInfo = docksData[dockKey];
            const pose = dockInfo.pose;
            const marker = dockInfo.aruco_markers;
            const dock_type = dockInfo.dock_type;
            docks.value.push({
              config_id: undefined,
              dock_id: dockKey,
              dock_type: dock_type,
              x: +pose[0],
              y: +pose[1],
              theta: +pose[2],
              aruco_id: marker.center
            });
          }
        } catch (err) {
          console.error("Invalid YAML file", err);
        }
      }
    };
    reader.readAsText(file);
  }

  function handleSubmit(data: { name: string, description: string }) {
    const formDataMap = handleMapSubmit();
    dockStore.createConfig(data, docks.value, formDataMap, robotPoses.value);
  }

  function handleMapSubmit() {
    const formData = new FormData();
    if (mapYamlFile.value) {
      formData.append("map_yaml", mapYamlFile.value);
    }
    if (mapImageFile.value) {
      formData.append("map_image", mapImageFile.value);
    }
    return formData;
  }
</script>
