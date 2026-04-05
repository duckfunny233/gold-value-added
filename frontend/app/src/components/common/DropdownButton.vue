<script setup>
import { ref } from 'vue'

const props = defineProps({
  icon: {
    type: Object,
    required: true
  },
  items: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['select'])

const show = ref(false)

const toggle = () => {
  show.value = !show.value
}

const handleSelect = (item) => {
  emit('select', item)
  show.value = false
}

const close = () => {
  show.value = false
}
</script>

<template>
  <div class="relative">
    <button 
      @click="toggle"
      class="p-1 text-gray-600 dark:text-gray-400 active:text-primary transition-colors"
    >
      <component :is="icon" :size="24" />
    </button>

    <div v-if="show" 
      class="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-[60] animate-in fade-in zoom-in-95 duration-100"
    >
      <button 
        v-for="item in items" 
        :key="item.action"
        @click="handleSelect(item)"
        class="w-full px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <component v-if="item.icon" :is="item.icon" :size="16" class="text-gray-500" />
        <span>{{ item.label }}</span>
      </button>
    </div>

    <div v-if="show" @click="close" class="fixed inset-0 z-40"></div>
  </div>
</template>