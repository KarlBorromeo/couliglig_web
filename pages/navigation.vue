<template>
  <v-container class="d-flex flex-column ga-5">
    <section class="">
      <h1>Navigation Manager</h1>
      <p>This section allows you to manage the navigation settings and files for the robots.</p>
    </section>
    <v-col>
      <v-file-input clearable label="Map Yaml" variant="outlined" accept=".yaml,.yml"></v-file-input>
      <v-file-input clearable label="Map Image" variant="outlined" accept=".pgm" ></v-file-input>
      <v-file-input clearable label="Dock Database" variant="outlined" accept=".yaml,.yml" v-model="mapYamlFile" ></v-file-input>        
    </v-col>
    <v-card elevation="3" class="pa-2">
      <v-table striped="even">
        <thead>
          <tr>
            <th>Pose X</th>
            <th>Pose Y</th>
            <th>Pose Theta</th>
            <th>Aruco Marker ID</th>
            <th>Add or Remove Box</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(dock, i) in docks" :key="i">
            <td>{{ dock.pose_x }}</td>
            <td>{{ dock.pose_y }}</td>
            <td>{{ dock.pose_theta }}</td>
            <td>{{ dock.marker_id }}</td>
            <td>
              <v-btn density="comfortable" color="success" icon="mdi-plus-box" @click="addBoxToDock(+dock.marker_id)" v-if="!docksHaveBoxes.includes(+dock.marker_id)"/>
              <v-btn density="comfortable" color="error" icon="mdi-minus-box" @click="removeBoxFromDock(+dock.marker_id)" v-else/>
            </td>
          </tr>
        </tbody>
      </v-table>
      <hr>
      <section class="mt-2">
        <p class="text-caption">Aruco ID markers with boxes:</p> 
        <p>{{ docksHaveBoxes.join(', ') }}</p>
      </section>
    </v-card>
    <UploadModal @submit="handleSubmit"/>
  </v-container>
</template>

<script setup lang="ts">
  import YAML from "yaml";
  const dockStore = useDockStore();
  const mapYamlFile = ref<File | null>(null);

  interface Dock {
    pose_x: string
    pose_y: string
    pose_theta: string
    marker_id: string
  }
  const docks = ref<Dock[]>([])
  const docksHaveBoxes = ref<number[]>([])

  watch(mapYamlFile, async (file: File | null) => {
    if (!file) {
      docks.value = [];
      docksHaveBoxes.value = [];
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
            docks.value.push({
              pose_x: pose[0].toString(),
              pose_y: pose[1].toString(),
              pose_theta: pose[2].toString(),
              marker_id: marker.center.toString()
            });
          }
        } catch (err) {
          console.error("Invalid YAML file", err);
        }
      }
    };
    reader.readAsText(file);
  }

  function addBoxToDock(marker_id: number) {
    docksHaveBoxes.value.push(marker_id)
  }
  function removeBoxFromDock(marker_id: number) {
    docksHaveBoxes.value = docksHaveBoxes.value.filter((id: number) => id !== marker_id)
  }

  function handleSubmit(data: { combinationName: string }) {
    console.log(dockStore.sample())
    alert(`Received combination name from modal: ${data.combinationName}`); 
  }
</script>
