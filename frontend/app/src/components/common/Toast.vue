<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  message: {
    type: String,
    default: ''
  },
  duration: {
    type: Number,
    default: 2000
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible'])

watch(() => props.visible, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      emit('update:visible', false)
    }, props.duration)
  }
})
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 bg-black/70 backdrop-blur-md text-white text-sm rounded-full shadow-xl pointer-events-none whitespace-nowrap">
      {{ message }}
    </div>
  </Transition>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>