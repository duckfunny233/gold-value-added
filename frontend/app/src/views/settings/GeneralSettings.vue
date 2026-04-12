<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'GeneralSettings' })

const router = useRouter()
const form = ref({
  noticePush: true,
  tradePush: true,
  servicePush: false,
  theme: 'dark',
  refreshSeconds: 3,
})

onMounted(async () => {
  const response = await SettingsService.getGeneralSettings()
  form.value = response.data
})

const saveGeneral = async () => {
  const response = await SettingsService.updateGeneralSettings(form.value)
  form.value = response.data
  showToast('通用设置已保存')
}
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">通用设置</h2>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">消息通知</h3>
        <div class="space-y-3 text-sm">
          <label class="flex items-center justify-between rounded-2xl bg-[#101b28] px-4 py-3"><span>系统通知</span><input v-model="form.noticePush" type="checkbox" class="h-4 w-4" /></label>
          <label class="flex items-center justify-between rounded-2xl bg-[#101b28] px-4 py-3"><span>交易提醒</span><input v-model="form.tradePush" type="checkbox" class="h-4 w-4" /></label>
          <label class="flex items-center justify-between rounded-2xl bg-[#101b28] px-4 py-3"><span>客服消息</span><input v-model="form.servicePush" type="checkbox" class="h-4 w-4" /></label>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">界面主题</h3>
        <select v-model="form.theme" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm text-white outline-none">
          <option value="dark">深色主题</option>
          <option value="auto">跟随系统</option>
        </select>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">行情刷新频率</h3>
        <select v-model="form.refreshSeconds" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm text-white outline-none">
          <option :value="1">1 秒</option>
          <option :value="3">3 秒</option>
          <option :value="5">5 秒</option>
          <option :value="10">10 秒</option>
        </select>
      </section>

      <button @click="saveGeneral" class="w-full rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact">保存通用设置</button>
    </div>
  </div>
</template>
