<script setup>
import { Eye } from 'lucide-vue-next'
defineProps({
  item: {
    type: Object,
    required: true
  },
  showSummary: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <div class="card-base p-4 flex gap-4 btn-interact cursor-pointer border-none shadow-sm">
    <!-- Image Placeholder (Conditional) -->
    <div v-if="item.thumbnail" class="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-xl shrink-0 overflow-hidden shadow-inner">
      <img :src="item.thumbnail" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110" :alt="item.title" />
    </div>
    
    <!-- Content -->
    <div class="flex flex-col justify-between flex-1 py-0.5">
      <div class="space-y-1.5">
        <h4 class="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight">
          {{ item.title }}
        </h4>
        <p v-if="showSummary && item.summary" class="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
          {{ item.summary }}
        </p>
      </div>
      <div class="flex items-center justify-between text-[10px] text-gray-400 font-medium mt-2">
        <span>{{ item.date }}</span>
        <span v-if="item.views" class="flex items-center gap-1 tabular-nums">
          <Eye :size="10" />
          {{ item.views }}
        </span>
      </div>
    </div>
  </div>
</template>