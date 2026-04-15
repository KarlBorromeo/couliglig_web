<template>
  <v-container class="d-flex flex-column ga-5">
    <section class="">
      <h1>Edit Config</h1>
      <p>This section allows you to edit the configuration settings and files for the robots.</p>
    </section>
    <v-col>
      <section class="d-flex flex-row align-center gap-2">
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
        <v-btn icon flat v-if="selectedDockConfig" @click="deleteConfig" >
          <v-icon class="text-black">mdi-trash-can</v-icon>
        </v-btn>
      </section>
      <p class="text-caption">Description: {{ selectedDockConfig ? dockConfigs.find(config => config.id === selectedDockConfig)?.description : '' }}</p>
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
              <th>Actions</th>
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
              <td>
                <v-btn icon flat @click="deleteDock(dock.id)">
                  <v-icon class="text-black">mdi-trash-can</v-icon>
                </v-btn>
              </td>
            </tr>
          </tbody>
          <v-footer class="d-flex align-center">
            <v-btn variant="flat" prepend-icon="mdi-plus" size="x-small" @click="addDock">Add Dock</v-btn>
          </v-footer>
        </v-table>
      </v-card>
    </v-col>
    <v-col>
      <section v-if="!isChangeMap">
        <v-text-field v-model="mapYamlFileText" label="Map Yaml" variant="outlined" readonly></v-text-field>
        <v-text-field v-model="mapImageFileText" label="Map Image" variant="outlined" readonly></v-text-field>        
      </section>
      <section v-else>
        <v-file-input v-model="mapYamlFile" clearable label="Map Yaml" variant="outlined" accept=".yaml,.yml"></v-file-input>
        <v-file-input v-model="mapImageFile" clearable label="Map Image" variant="outlined" accept=".pgm"></v-file-input>         
      </section>
      <v-btn :disabled="!selectedDockConfig" @click="toggleChangeMap" :color="isChangeMap?'': 'info'">{{ isChangeMap ? 'Cancel' : 'Change Map' }}</v-btn>
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
              <th>Actions</th>
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
              <td>
                <v-btn icon flat @click="deleteRobotInitialPose(robot.id)">
                  <v-icon class="text-black">mdi-trash-can</v-icon>
                </v-btn>
              </td>
            </tr>
          </tbody>
          <v-footer class="d-flex align-center">
            <v-btn variant="flat" prepend-icon="mdi-plus" size="x-small" @click="addRobotPose">Add Robot</v-btn>
          </v-footer>
        </v-table>
      </v-card>
    </v-col>
    <v-btn color="primary" prepend-icon="mdi-update" @click="updateConfig">Update Config</v-btn>
    <Snackbar ref="snackbar" />
    <LoadingScreen v-model="loading" />
  </v-container>
</template>
<script setup lang="ts">
  const dockStore = useDockStore()
  const dockConfigs = computed(() => dockStore.dockConfigs)
  const selectedDockConfig = ref<number | null>(null)
  const docks = ref<Docks[]>([])
  const dockingTypes = ['pickup', 'receiver', 'waiting_zone', 'hand_off']
  const snackbar = ref<any>(null)
  const loading = ref(false)
  const robotPoses = ref<robotPose[]>([])
  const listRobotNames = ['couliglig_bot_1', 'couliglig_bot_2', 'couliglig_bot_3', 'couliglig_bot_4', 'couliglig_bot_5', 'couliglig_bot_6', 'couliglig_bot_7', 'couliglig_bot_8', 'couliglig_bot_9', 'couliglig_bot_10']
  let robotNames = ref<string[]>([...listRobotNames])
  const mapId = ref<number | null>(null)
  const mapYamlFileText = ref<string>('');
  const mapImageFileText = ref<string>('');
  const mapYamlFile = ref<File | null>(null);
  const mapImageFile = ref<File | null>(null);
  const isChangeMap = ref(false);

  onMounted(async () => {
    try{
      loading.value = true;
      await dockStore.fetchDockConfigs()
    } catch (error:any) {
      snackbar.value?.showSnackbar(error, 'red');
      return;
    } finally {
      loading.value = false;
    }
  })

  watch (selectedDockConfig, async (newConfigId) => {
    try{
      if (newConfigId !== null) {
        try{
          loading.value = true;
          docks.value = await dockStore.fetchDocksAll(newConfigId)
          const map_res = await dockStore.getMap(newConfigId)
          if (!map_res) {
            snackbar.value?.showSnackbar('No map found for selected configuration', 'orange');
            robotPoses.value = []
            return;
          }
          mapId.value = map_res.id
          mapYamlFileText.value = map_res.map_yaml_path || '';
          mapImageFileText.value = map_res.map_image_path || '';
          const robot_pose_res = await dockStore.getRobotInitialPoses(mapId.value)
          console.log("Fetched robot initial poses:", robot_pose_res);
          robotPoses.value = robot_pose_res
        } catch (error:any) {
          snackbar.value?.showSnackbar(error, 'red');
          return;
        } finally {
          loading.value = false;
        }
      } else {
        docks.value = []
        robotPoses.value = []
        mapId.value = null
        isChangeMap.value = false
        mapYamlFileText.value = '';
        mapImageFileText.value = '';
        mapYamlFile.value = null;
        mapImageFile.value = null;
      }
    } catch (error:any) {
      snackbar.value?.showSnackbar(error, 'red');
    }
  })

  watch(robotPoses, (newVal) => {
    console.log("Updated Robot Poses:", newVal);
    const addedNames = newVal.map(robot => robot.robot_name).filter(name => name !== '');
    robotNames.value = listRobotNames.filter(name => !addedNames.includes(name));
  }, { deep: true })

  function toggleChangeMap() {
    isChangeMap.value = !isChangeMap.value;
    if (!isChangeMap.value) {
      mapYamlFile.value = null;
      mapImageFile.value = null;
    }
  }

  interface Docks {
    id: number | undefined;
    config_id: number;
    dock_id: string;
    dock_type: string;
    x: number;
    y: number;
    theta: number;
    aruco_id: number;
  }

  interface robotPose {
    id: number | undefined;
    robot_name: string
    initial_x: number
    initial_y: number
    initial_theta: number
    map_id: number
  }

  function addDock() {
    if (selectedDockConfig.value === null) {
      snackbar.value?.showSnackbar('Please select a dock configuration before adding docks', 'orange');
      return;
    }
    docks.value.push({
      id: undefined,
      config_id: selectedDockConfig.value,
      dock_id: `dock_${docks.value.length}`,
      dock_type: 'pickup',
      x: 0,
      y: 0,
      theta: 0,
      aruco_id: 0
    })
  }

  function addRobotPose() {
    if (!mapId.value) {
      snackbar.value?.showSnackbar('Please select a dock configuration before adding robot poses', 'orange');
      return;
    }
    robotPoses.value.push({
      id: undefined,
      robot_name: '',
      initial_x: 0,
      initial_y: 0,
      initial_theta: 0,
      map_id: mapId.value
    })
  }
  
  async function deleteConfig() {
    const isConfirmed = confirm('Are you sure you want to delete this configuration? This action cannot be undone.');
    if (!isConfirmed) {
      return;
    }
    if (selectedDockConfig.value === null || mapId.value === null) {
      snackbar.value?.showSnackbar('No configuration selected to delete and mapID is null', 'red');
      return;
    }

    await dockStore.deleteConfig(selectedDockConfig.value)
    selectedDockConfig.value = null;
    snackbar.value?.showSnackbar('Configuration deleted successfully', 'green');

  }

  async function updateConfig(){
    try{
      console.log("Updating config with docks:", docks.value, "and robot poses:", robotPoses.value);
      loading.value = true;

      const activatedConfig = dockStore.dockConfigs.find(config => config.id === selectedDockConfig.value && config.is_active)
      if (activatedConfig) {
        await dockStore.dockClear()
      }

      if (selectedDockConfig.value === null) {
        snackbar.value?.showSnackbar('No configuration selected to update', 'red');
        return;
      }
      await dockStore.updateDocks(docks.value)
      docks.value = await dockStore.fetchDocksAll(selectedDockConfig.value)

      if (mapId.value === null) {
        snackbar.value?.showSnackbar('No map associated with this configuration, cannot update robot poses', 'red');
        return;
      }

      if (isChangeMap.value) {
        await dockStore.updateMap(handleMapSubmit())
        const map_res = await dockStore.getMap(selectedDockConfig.value)
        if (!map_res) {
          snackbar.value?.showSnackbar('No map found for selected configuration', 'orange');
          robotPoses.value = []
          return;
        }
        mapId.value = map_res.id
        mapYamlFileText.value = map_res.map_yaml_path || '';
        mapImageFileText.value = map_res.map_image_path || '';
        isChangeMap.value = false;
      }

      if (mapId.value === null) {
        snackbar.value?.showSnackbar('No map associated with this configuration, cannot update robot poses', 'red');
        return;
      }
      
      await dockStore.updateRobotInitialPoses(robotPoses.value)
      robotPoses.value = await dockStore.getRobotInitialPoses(mapId.value)


    } catch (error:any) {
      snackbar.value?.showSnackbar(error, 'red');
      return;
    } finally {
      loading.value = false;
    }
  }

  async function deleteDock(dock_id: number | undefined) {
    const isConfirmed = confirm('Are you sure you want to delete this dock? This action cannot be undone.');
    if (!isConfirmed) {
      return;
    }
    if (dock_id === undefined) {
      snackbar.value?.showSnackbar('Dock ID is undefined, cannot delete dock', 'red');
      return;
    }
    try {
      loading.value = true;
      await dockStore.deleteDock(dock_id)
      docks.value = await dockStore.fetchDocksAll(selectedDockConfig.value!)
      snackbar.value?.showSnackbar('Dock deleted successfully', 'green');
    } catch (error:any) {
      snackbar.value?.showSnackbar(error, 'red');
      return;
    } finally {
      loading.value = false;
    }
  }

  async function deleteRobotInitialPose(pose_id: number | undefined) {
    const isConfirmed = confirm('Are you sure you want to delete this robot initial pose? This action cannot be undone.');
    if (!isConfirmed) {
      return;
    }
    if (pose_id === undefined) {
      snackbar.value?.showSnackbar('Pose ID is undefined, cannot delete robot initial pose', 'red');
      return;
    }
    try {
      loading.value = true;
      await dockStore.deleteRobotInitialPose(pose_id)
      robotPoses.value = await dockStore.getRobotInitialPoses(mapId.value!)
      snackbar.value?.showSnackbar('Robot initial pose deleted successfully', 'green');
    } catch (error:any) {
      snackbar.value?.showSnackbar(error, 'red');
      return;
    } finally {
      loading.value = false;
    }
  }

  function handleMapSubmit() {
    const formData = new FormData();
    if (mapYamlFile.value) {
      formData.append("map_yaml", mapYamlFile.value);
    }
    if (mapImageFile.value) {
      formData.append("map_image", mapImageFile.value);
    }
    formData.append("dock_config_id", selectedDockConfig.value!.toString());
    formData.append("map_db_id", mapId.value!.toString());
    return formData;
  }
</script>

<!-- TODO: in update and delete docks request to shane to do list not specific objects -->