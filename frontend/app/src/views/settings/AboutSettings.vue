<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'AboutSettings' })

const router = useRouter()
const { t } = useI18n()
const data = ref({ version: '--', buildTime: '--', notices: [] })

onMounted(async () => {
  const response = await SettingsService.getAboutSettings()
  data.value = response.data
})

const openEntry = (title) => {
  showToast(t('settings.about.entryToast', { title }))
}
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">{{ t('settings.about.title') }}</h2>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.about.sectionVersion') }}</h3>
        <div class="space-y-2 text-sm">
          <p class="rounded-2xl bg-[#101b28] px-4 py-3">{{ t('settings.about.currentVersion') }}{{ data.version }}</p>
          <p class="rounded-2xl bg-[#101b28] px-4 py-3">{{ t('settings.about.buildDate') }}{{ data.buildTime }}</p>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.about.sectionNotices') }}</h3>
        <div class="space-y-2">
          <div v-for="item in data.notices" :key="item.id" class="rounded-2xl bg-[#101b28] px-4 py-3 text-sm">
            <p class="font-bold">{{ t(item.title) }}</p>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ item.time }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.about.sectionPolicies') }}</h3>
        <div class="grid grid-cols-2 gap-2">
          <button @click="openEntry(t('settings.about.userAgreement'))" class="rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm font-bold btn-interact">{{ t('settings.about.userAgreement') }}</button>
          <button @click="openEntry(t('settings.about.privacyPolicy'))" class="rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm font-bold btn-interact">{{ t('settings.about.privacyPolicy') }}</button>
        </div>
      </section>
    </div>
  </div>
</template>
