<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps({
  items: {
    type: Array,
    default: () => [1, 2, 3, 4, 5]
  },
  showArrows: {
    type: Boolean,
    default: true
  },
  showScrollbar: {
    type: Boolean,
    default: true
  },
  itemClass: {
    type: String,
    default: 'bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md snap-center border border-gray-100 dark:border-gray-700'
  }
})

const containerRef = ref(null)

const scroll = (direction) => {
  if (!containerRef.value) return
  const scrollAmount = containerRef.value.clientWidth * 0.8
  containerRef.value.scrollBy({
    left: direction === 'left' ? -scrollAmount : scrollAmount,
    behavior: 'smooth'
  })
}
</script>

<template>
  <div class="mt-2 relative group">
    <!-- Navigation Arrows -->
    <template v-if="showArrows && items.length > 0">
      <button 
        @click="scroll('left')"
        class="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm border border-white/10"
      >
        <ChevronLeft :size="20" />
      </button>
      <button 
        @click="scroll('right')"
        class="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm border border-white/10"
      >
        <ChevronRight :size="20" />
      </button>
    </template>

    <div 
      ref="containerRef"
      :class="[
        'flex w-full gap-4 overflow-x-auto pb-4 snap-x snap-mandatory px-6 custom-scrollbar',
        !showScrollbar ? 'scrollbar-hide' : ''
      ]"
    >
      <div class="w-[1px] flex-none invisible"></div>
      <div 
        v-for="(item, index) in items" 
        :key="index" 
        :class="['w-[85%] flex-none aspect-[16/10]', props.itemClass]"
      >
        <slot :item="item" :index="index">
          <div class="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 flex flex-col items-center justify-center text-gray-300 gap-3">
            <span class="text-sm font-bold text-gray-400">{{ t('components.imageCarousel.recommendation', { index: index + 1 }) }}</span>
            <div class="w-12 h-12 rounded-2xl bg-white dark:bg-gray-600 shadow-sm flex items-center justify-center">
              <span class="text-primary font-bold">G{{ index + 1 }}</span>
            </div>
          </div>
        </slot>
      </div>
      <div class="w-[1px] flex-none invisible"></div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Styled scrollbar for when showScrollbar is true */
.custom-scrollbar::-webkit-scrollbar {
  height: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.2);
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.4);
}
</style>
