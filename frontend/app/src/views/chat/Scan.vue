<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Camera, ScanLine, CheckCircle2, ImageIcon } from 'lucide-vue-next'
import { ChatService } from '../../services/chat'

const router = useRouter()
const { t } = useI18n()
const scanning = ref(true)
const scanCode = ref('')
const result = ref(null)
const parsing = ref(false)
const fileInput = ref(null)

const parseCode = async (code) => {
  const normalizedCode = String(code || '').trim()
  if (!normalizedCode) return
  parsing.value = true
  try {
    const response = await ChatService.parseScan(normalizedCode)
    result.value = response.data
    scanning.value = false
  } catch (error) {
    console.error('Parse scan failed:', error)
  } finally {
    parsing.value = false
  }
}

const handleAction = () => {
  if (!result.value) return
  if (result.value.type === 'friend') {
    router.replace({ path: '/chat/add-friend', query: { targetId: result.value.targetId } })
    return
  }
  if (result.value.type === 'group') {
    router.replace(`/chat/${result.value.targetId}`)
    return
  }
  router.back()
}

const handleImageScan = () => {
  fileInput.value.click()
}

const handleFileChange = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // 模拟从图片中识别二维码
  // 实际项目中这里应该使用真实的二维码识别库
  parsing.value = true
  try {
    // 模拟识别过程
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 模拟识别结果
    const mockResult = {
      type: 'friend',
      targetId: 'U0000201',
      title: '金币观察员',
      description: '添加金币观察员为好友',
      actionLabel: '添加好友'
    }
    
    result.value = mockResult
    scanning.value = false
  } catch (error) {
    console.error('Image scan failed:', error)
  } finally {
    parsing.value = false
    // 重置文件输入
    event.target.value = ''
  }
}

onMounted(() => {
  scanning.value = true
})
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <div>
        <h2 class="text-lg font-bold">{{ t('chat.scan') }}</h2>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-4">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="relative overflow-hidden rounded-3xl border border-[#35506d] bg-[#0f1b29] p-4">
          <div class="flex w-full aspect-square items-center justify-center rounded-2xl border border-dashed border-[#35506d] bg-[radial-gradient(circle_at_center,_rgba(201,155,24,0.12),_transparent_60%)]">
            <Camera :size="42" class="text-[#8e9bb0]" />
          </div>
          <div class="pointer-events-none absolute left-8 right-8 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-[#19c58a] to-transparent shadow-[0_0_14px_rgba(25,197,138,0.7)] animate-pulse"></div>
          <div class="mt-4 flex items-center justify-between text-xs text-[#8e9bb0]">
            <div class="flex items-center gap-2">
              <ScanLine :size="16" class="text-[#19c58a]" />
              {{ scanning ? t('chat.scanPage.cameraOpen') : t('chat.scanPage.parsedReady') }}
            </div>
            <button 
              @click="handleImageScan"
              class="flex items-center gap-1 text-[#c99b18] hover:text-[#f2c24a] transition-colors btn-interact"
              :title="'选择图片扫码'"
            >
              <ImageIcon :size="16" />
            </button>
          </div>
        </div>
      </section>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileChange"
      />

      <section v-if="result" class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="flex items-start gap-3">
          <CheckCircle2 :size="20" class="mt-0.5 text-[#19c58a]" />
          <div>
            <h3 class="text-base font-bold">{{ result.title }}</h3>
            <p class="mt-2 text-sm text-[#d7e0ea]">{{ result.description }}</p>
          </div>
        </div>
        <button @click="handleAction" class="mt-4 w-full rounded-2xl bg-[#c99b18] px-4 py-3 text-sm font-bold text-white btn-interact">
          {{ parsing ? t('chat.scanPage.parsing') : result.actionLabel }}
        </button>
      </section>
    </div>
  </div>
</template>
