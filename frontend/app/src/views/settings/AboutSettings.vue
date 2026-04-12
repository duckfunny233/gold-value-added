<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'AboutSettings' })

const router = useRouter()
const data = ref({ version: '--', buildTime: '--', notices: [] })

onMounted(async () => {
  const response = await SettingsService.getAboutSettings()
  data.value = response.data
})

const openEntry = (title) => {
  showToast(`${title}入口（仅查看）`)
}
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">关于我们</h2>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">版本信息</h3>
        <div class="space-y-2 text-sm">
          <p class="rounded-2xl bg-[#101b28] px-4 py-3">当前版本：{{ data.version }}</p>
          <p class="rounded-2xl bg-[#101b28] px-4 py-3">构建日期：{{ data.buildTime }}</p>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">系统公告</h3>
        <div class="space-y-2">
          <div v-for="item in data.notices" :key="item.id" class="rounded-2xl bg-[#101b28] px-4 py-3 text-sm">
            <p class="font-bold">{{ item.title }}</p>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ item.time }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">协议与政策（仅查看入口）</h3>
        <div class="grid grid-cols-2 gap-2">
          <button @click="openEntry('用户协议')" class="rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm font-bold btn-interact">用户协议</button>
          <button @click="openEntry('隐私政策')" class="rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm font-bold btn-interact">隐私政策</button>
        </div>
      </section>
    </div>
  </div>
</template>
