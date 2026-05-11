<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'
import { useMarketPolling, invalidateSettingsCache, updateGlobalRefreshSeconds } from '../../composables/useMarketPolling'

defineOptions({ name: 'GeneralSettings' })

const router = useRouter()
const { t } = useI18n()
const form = ref({
  noticePush: true,
  tradePush: true,
  servicePush: true,
  theme: 'dark',
  refreshSeconds: 5,
})

onMounted(async () => {
  const response = await SettingsService.getGeneralSettings()
  form.value = response.data
  if (![1, 5, 10].includes(Number(form.value.refreshSeconds))) {
    form.value.refreshSeconds = 5
  }
})

const saveGeneral = async () => {
  const response = await SettingsService.updateGeneralSettings(form.value)
  form.value = response.data
  updateGlobalRefreshSeconds(response.data.refreshSeconds)
  showToast(t('settings.general.toast.saved'))
}
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">{{ t('settings.general.title') }}</h2>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.general.sectionNotice') }}</h3>
        <div class="space-y-3 text-sm">
          <label class="flex items-center justify-between rounded-2xl bg-[#101b28] px-4 py-3"><span>{{ t('settings.general.notice.system') }}</span><input v-model="form.noticePush" type="checkbox" class="h-4 w-4" /></label>
          <label class="flex items-center justify-between rounded-2xl bg-[#101b28] px-4 py-3"><span>{{ t('settings.general.notice.trade') }}</span><input v-model="form.tradePush" type="checkbox" class="h-4 w-4" /></label>
          <label class="flex items-center justify-between rounded-2xl bg-[#101b28] px-4 py-3"><span>{{ t('settings.general.notice.service') }}</span><input v-model="form.servicePush" type="checkbox" class="h-4 w-4" /></label>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.general.sectionTheme') }}</h3>
        <select v-model="form.theme" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm text-white outline-none">
          <option value="dark">{{ t('settings.general.theme.dark') }}</option>
          <option value="auto">{{ t('settings.general.theme.auto') }}</option>
        </select>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.general.sectionRefresh') }}</h3>
        <select v-model="form.refreshSeconds" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm text-white outline-none">
          <option :value="1">{{ t('settings.general.seconds', { value: 1 }) }}</option>
          <option :value="5">{{ t('settings.general.seconds', { value: 5 }) }}</option>
          <option :value="10">{{ t('settings.general.seconds', { value: 10 }) }}</option>
        </select>
      </section>

      <button @click="saveGeneral" class="w-full rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact">{{ t('settings.general.save') }}</button>
    </div>
  </div>
</template>
