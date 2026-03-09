<template>
    <v-snackbar
      v-model="snackbar"
      :timeout="timeout"
      :color="colorBg"
    >
      {{ text }}

      <template v-slot:actions>
        <v-btn
          color="blue"
          variant="text"
          @click="snackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const snackbar = ref(false)
const text = ref('')
const timeout = ref(3000)
const colorBg = ref('green')

function showSnackbar(message: string, color: string = 'green', duration: number = 3000) {
  text.value = message
  timeout.value = duration
  colorBg.value = color
  snackbar.value = true
}
defineExpose({
  showSnackbar
})
</script>