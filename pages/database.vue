<template>
  <v-container class="d-flex flex-column ga-5">
    <section class="">
      <h1>Create Docking Database</h1>
      <p>This section allows you to generate the docking database for the robots.</p>
    </section>

    <v-col class="d-flex flex-grow ga-2">
        <v-btn elevation="2" color="primary" prepend-icon="mdi-plus" @click="addDock">Add Dock</v-btn>
        <v-btn elevation="2" color="primary" prepend-icon="mdi-text-box" @click="generateYAML">Generate YAML</v-btn>
        <v-btn elevation="2" color="primary" prepend-icon="mdi-download" @click="downloadYAML">Download YAML</v-btn>
    </v-col>
    <v-col>
        <v-file-input clearable label="File input" variant="outlined" accept=".yaml,.yml" v-model="uploadedFile"></v-file-input>
    </v-col>
    <v-card elevation="3" v-for="(dock, i) in docks" :key="i">
        <v-card-text>
          <v-row>
            <v-col sm="4">
              <v-text-field label="Dock ID" v-model="dock.dock_id" variant="outlined"></v-text-field>
            </v-col>
            <v-col sm="4">
              <v-text-field label="Pose X" v-model="dock.pose_x" variant="outlined" type="number"></v-text-field>
            </v-col>
            <v-col sm="4">
              <v-text-field label="Pose Y" v-model="dock.pose_y" variant="outlined" type="number"></v-text-field>
            </v-col>
            <v-col sm="4">
              <v-text-field label="Pose Theta" v-model="dock.pose_theta" variant="outlined" type="number"></v-text-field>
            </v-col>
            <v-col sm="4">
              <v-text-field label="Aruco Marker ID" v-model="dock.marker_id" variant="outlined" type="number"></v-text-field>
            </v-col>   
            <v-col sm="3">
                <v-select
                  :items="dockingTypes"
                  v-model="dock.dock_type"
                  variant="outlined"
                  class="mx-auto my-0"
                  hide-details
                ></v-select>
            </v-col>
            <v-col sm="1">
                <v-btn icon="mdi-trash-can-outline" color="primary" size="small" @click="deleteDock(i)"></v-btn>
            </v-col>         
          </v-row>
        </v-card-text>
    </v-card>

    <v-card elevation="3">
        <v-card-title><v-icon size="20">mdi-code-json</v-icon> Generated YAML</v-card-title>
        <v-card-text>
            <pre>
                <code>
                  {{ generatedYaml }}
                </code>
            </pre>
        </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
  import YAML from "yaml";
  interface Dock {
    dock_id: string
    pose_x: string
    pose_y: string
    pose_theta: string
    marker_id: string
    dock_type: string
  }

  let docks = ref<Dock[]>([])
  const generatedYaml = ref<string>('')
  const uploadedFile = ref<File | null>(null)
  const dockingTypes = ['pickup', 'receiver', 'waiting_zone']

  function addDock() {
    docks.value.push(
      {
        dock_id: '',
        pose_x: '',
        pose_y: '',
        pose_theta: '',
        marker_id: '',
        dock_type: 'pickup' // default type, can be changed by user
      }
    )
  }

  function deleteDock(i: number){
    docks.value.splice(i, 1)
    generateYAML() // update yaml after deletion
  }

  function formatFloat(value: string) {
    const num = parseFloat(value.toString());
    if (Number.isInteger(num)) {
      return num.toFixed(1);   // adds .0
    }
    return num.toString();
  }

  function rotate180(theta : string) {
    let newTheta = Number(theta) + 3.14;
    if (newTheta > 3.14) {
      newTheta -= 2 * 3.14;
    }
    if (newTheta < -3.14) {
      newTheta += 2 * 3.14;
    }
    return newTheta.toFixed(2);
  }

  function generateYAML() {
    let outputText =`\ndocks:\n`
    docks.value.forEach((dock : Dock , i: number) => {
      const dockId = dock.dock_id || `dock_${i}`
      const px = formatFloat(dock.pose_x);
      const py = formatFloat(dock.pose_y);
      const pt = formatFloat(dock.pose_theta);
      const mx = px
      const my = py
      // calculate 180 deg rotation from pt
      const mt = rotate180(pt);
      const center = dock.marker_id;
      outputText +=`  ${dockId}:\n`;
      outputText +=`    pose: [${px}, ${py}, ${pt}]\n`;
      outputText +=`    aruco_markers:\n`;
      outputText +=`      pos: [${mx}, ${my}, ${mt}]\n`;
      outputText +=`      center: ${center}\n`;
      outputText +=`    dock_type: ${dock.dock_type}\n\n`;
    });
    generatedYaml.value = outputText
  }

  function downloadYAML(){
    if (!generatedYaml.value) return
    generateYAML() // ensure yaml is up to date with latest changes
    const cleanedYaml = generatedYaml.value.trimStart()
    const blob = new Blob([cleanedYaml], {
      type: 'text/yaml;charset=utf-8;'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'docking_database.yaml'
    link.click()
    URL.revokeObjectURL(url)
  }

  function loadYaml(file : File | null) {
    if (!file) return;
    resetDocks();
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
              dock_id: dockKey,
              pose_x: pose[0].toString(),
              pose_y: pose[1].toString(),
              pose_theta: pose[2].toString(),
              marker_id: marker.center.toString(),
              dock_type: 'pickup' // default type, can be changed by user
            });
          }
          generateYAML()
        } catch (err) {
          console.error("Invalid YAML file", err);
        }
      }
    };
    reader.readAsText(file);
  }

  function resetDocks() {
    docks.value = [];
  }

  watch(uploadedFile, async (file: File | null) => {
    if (!file) {
      resetDocks();
      generatedYaml.value = '';
      return;
    }

    try {
      loadYaml(file)
    } catch (error) {
      console.error('Error reading file:', error)
    }
  })

</script>