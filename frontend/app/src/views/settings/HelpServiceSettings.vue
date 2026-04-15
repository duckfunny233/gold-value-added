<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, MessageCircle } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'HelpServiceSettings' })

const router = useRouter()
const { t } = useI18n()
const faq = ref([])
const feedback = ref('')

onMounted(async () => {
  const response = await SettingsService.getHelpSettings()
  faq.value = response.data.faq || []
})

const goCustomer = () => {
  router.push({ path: '/chat/2', query: { title: t('settings.help.customerTitle') } })
}

const submitFeedback = async () => {
  if (!feedback.value.trim()) {
    showToast(t('settings.help.toast.emptyFeedback'))
    return
  }
  await SettingsService.submitFeedback(feedback.value.trim())
  feedback.value = ''
  showToast(t('settings.help.toast.feedbackSubmitted'))
}
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">{{ t('settings.help.title') }}</h2>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <button @click="goCustomer" class="w-full rounded-2xl bg-[#223244] px-4 py-3 text-left btn-interact">
        <p class="text-sm font-bold flex items-center gap-2"><MessageCircle :size="16" class="text-[#19c58a]" />{{ t('settings.help.customerService') }}</p>
        <p class="mt-1 text-xs text-[#8e9bb0]">{{ t('settings.help.customerDesc') }}</p>
      </button>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.help.faqTitle') }}</h3>
        <div class="space-y-2">
          <div v-for="item in faq" :key="item.id" class="rounded-2xl bg-[#101b28] px-4 py-3">
            <p class="text-sm font-bold">{{ t(item.q) }}</p>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ t(item.a) }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.help.feedbackTitle') }}</h3>
        <textarea v-model="feedback" rows="4" :placeholder="t('settings.help.feedbackPlaceholder')" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm text-white outline-none placeholder:text-[#6f8093]"></textarea>
        <button @click="submitFeedback" class="mt-3 w-full rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact">{{ t('settings.help.feedbackSubmit') }}</button>
      </section>
    </div>
  </div>
</template>
