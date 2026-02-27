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
              <v-text-field label="Pose X" v-model="dock.pose_x" variant="outlined" type="number"></v-text-field>
            </v-col>
            <v-col sm="4">
              <v-text-field label="Pose Y" v-model="dock.pose_y" variant="outlined" type="number"></v-text-field>
            </v-col>
            <v-col sm="4">
              <v-text-field label="Pose Theta" v-model="dock.pose_theta" variant="outlined" type="number"></v-text-field>
            </v-col>
            <v-col cols="11" class="d-flex justify-space-between">
              <v-text-field label="Aruco Marker ID" v-model="dock.marker_id" variant="outlined" type="number"></v-text-field>
            </v-col>   
            <v-col cols="1" class="d-flex justify-center">
              <v-btn icon="mdi-close" color="red" size="small" @click="deleteDock(i)"></v-btn>
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
  // import yaml from 'js-yaml'
  interface Dock {
    pose_x: string
    pose_y: string
    pose_theta: string
    marker_id: string
  }

  let docks = ref<Dock[]>([])
  const generatedYaml = ref<string>('')
  const uploadedFile = ref<File | null>(null)

  function addDock() {
    docks.value.push(
      {
        pose_x: '',
        pose_y: '',
        pose_theta: '',
        marker_id: ''
      }
    )
  }

  function deleteDock(i: number){
    docks.value.splice(i, 1)
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
      const px = formatFloat(dock.pose_x);
      const py = formatFloat(dock.pose_y);
      const pt = formatFloat(dock.pose_theta);
      const mx = px
      const my = py
      // calculate 180 deg rotation from pt
      const mt = rotate180(pt);
      const center = dock.marker_id;
      outputText +=`  dock_${i}:\n`;
      outputText +=`    pose: [${px}, ${py}, ${pt}]\n`;
      outputText +=`    aruco_markers:\n`;
      outputText +=`      pos: [${mx}, ${my}, ${mt}]\n`;
      outputText +=`      center: ${center}\n\n`;
    });
    generatedYaml.value = outputText
  }

  function downloadYAML(){
    if (!generatedYaml.value) return
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

  function parseYaml(text: string) {
    // This is a placeholder for YAML parsing logic.
    // You can use a library like js-yaml to parse the YAML content and populate the docks array.
    // For example:
    // const data = yaml.load(text);
    // Then you would need to transform the data into the format expected by the docks array.
  }

  watch(uploadedFile, async (file: File | null) => {
    if (!file) return

    try {
      const text = await file.text()
      generatedYaml.value = `\n` + text
      // parseYaml(text)
    } catch (error) {
      console.error('Error reading file:', error)
    }
  })

</script>