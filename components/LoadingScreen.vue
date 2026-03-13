<template>
  <transition name="fade">
    <div v-if="modelValue" class="overlay">
      <div class="loader">
        <v-progress-circular
          color="primary"
          indeterminate
          size="64"
          width="6"
        />
      </div>
    </div>
  </transition>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: true
  }
})
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;

  display: flex;
  align-items: center;
  justify-content: center;

  background: rgba(0, 0, 0, 0.123);
  backdrop-filter: blur(3px);
}

.loader {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* smooth fade animation */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>