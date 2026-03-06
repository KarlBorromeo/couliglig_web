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
    <v-card elevation="3" class="pa-2">
      <v-table striped="even">
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
            <td>{{ dock.dock_id }}</td>
            <td>{{ dock.x }}</td>
            <td>{{ dock.y }}</td>
            <td>{{ dock.theta }}</td>
            <td>{{ dock.aruco_id }}</td>
            <td>
                <v-select
                  :items="dockingTypes"
                  v-model="dock.dock_type"
                  variant="outlined"
                  density="compact"
                  class="mx-auto my-0"
                  hide-details
                ></v-select>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
    <UploadModal @submit="handleSubmit"/>
  </v-container>
</template>

<script setup lang="ts">
  import YAML from "yaml";
  const dockStore = useDockStore();
  const dockYamlFile = ref<File | null>(null);
  const mapYamlFile = ref<File | null>(null);
  const mapImageFile = ref<File | null>(null);

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
  const docks = ref<Dock[]>([])

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
    dockStore.createConfig(data, docks.value, formDataMap)
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
