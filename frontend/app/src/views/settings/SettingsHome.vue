<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, ShieldCheck, UserRoundCog, SlidersHorizontal, LifeBuoy, Info, UserX } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'SettingsHome' })

const router = useRouter()
const { t } = useI18n()
const items = ref([])
const loading = ref(false)

const iconMap = {
  security: ShieldCheck,
  account: UserRoundCog,
  general: SlidersHorizontal,
  help: LifeBuoy,
  about: Info,
  'cancel-account': UserX,
}

onMounted(async () => {
  loading.value = true
  try {
    const response = await SettingsService.getSettingsOverview()
    items.value = Array.isArray(response?.data) ? response.data : []
  } catch (error) {
    console.error('Failed to load settings overview:', error)
    items.value = []
    showToast('设置项加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">{{ t('settings.title') }}</h2>
    </header>

    <div class="flex-1 overflow-y-auto py-4">
      <div v-if="loading" class="px-4 py-6 text-sm text-[#8e9bb0]">加载中...</div>
      <div v-else class="border-y border-[#2b3b4c] bg-[#162331]">
        <button
          v-for="item in items"
          :key="item.key"
          @click="router.push(`/settings/${item.key}`)"
          class="flex w-full items-center gap-3 border-b border-[#2b3b4c] px-4 py-4 text-left transition-all btn-interact hover:bg-[#1f2d3d] last:border-b-0"
        >
          <div class="flex h-10 w-10 items-center justify-center bg-[#223244] text-[#c99b18]">
            <component :is="iconMap[item.key]" :size="20" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-[#ecf2f9]">{{ item.title || t(`settings.overview.${item.key}.title`) }}</p>
            <p class="mt-1 truncate text-xs text-[#8e9bb0]">{{ item.desc || t(`settings.overview.${item.key}.desc`) }}</p>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
