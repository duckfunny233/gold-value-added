<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, MessageCircle } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'HelpServiceSettings' })

const router = useRouter()
const faq = ref([])
const feedback = ref('')

onMounted(async () => {
  const response = await SettingsService.getHelpSettings()
  faq.value = response.data.faq || []
})

const goCustomer = () => {
  router.push({ path: '/chat/2', query: { title: '客服专员' } })
}

const submitFeedback = async () => {
  if (!feedback.value.trim()) {
    showToast('请先填写反馈内容')
    return
  }
  await SettingsService.submitFeedback(feedback.value.trim())
  feedback.value = ''
  showToast('意见反馈已提交')
}
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">帮助服务</h2>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <button @click="goCustomer" class="w-full rounded-2xl bg-[#223244] px-4 py-3 text-left btn-interact">
        <p class="text-sm font-bold flex items-center gap-2"><MessageCircle :size="16" class="text-[#19c58a]" />在线客服</p>
        <p class="mt-1 text-xs text-[#8e9bb0]">点击进入客服会话</p>
      </button>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">常见问题</h3>
        <div class="space-y-2">
          <div v-for="item in faq" :key="item.id" class="rounded-2xl bg-[#101b28] px-4 py-3">
            <p class="text-sm font-bold">{{ item.q }}</p>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ item.a }}</p>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">意见反馈</h3>
        <textarea v-model="feedback" rows="4" placeholder="请输入你的意见或建议" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm text-white outline-none placeholder:text-[#6f8093]"></textarea>
        <button @click="submitFeedback" class="mt-3 w-full rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact">提交反馈</button>
      </section>
    </div>
  </div>
</template>
