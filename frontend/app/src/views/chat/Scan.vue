<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Camera, ScanLine, CheckCircle2 } from 'lucide-vue-next'
import { ChatService } from '../../services/chat'
import { scanEntriesMock } from '../../services/chat-mock'

const router = useRouter()
const scanning = ref(true)
const scanItems = ref([])
const selectedCode = ref('')
const result = ref(null)
const parsing = ref(false)

const loadScanItems = () => {
  scanItems.value = scanEntriesMock
  if (scanItems.value.length) {
    selectedCode.value = scanItems.value[0].code
  }
}

const parseCode = async (code) => {
  parsing.value = true
  selectedCode.value = code
  try {
    const response = await ChatService.parseScan(code)
    result.value = response.data
    scanning.value = false
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

onMounted(() => {
  loadScanItems()
})
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <div>
        <h2 class="text-lg font-bold">扫一扫</h2>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-4">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="relative overflow-hidden rounded-3xl border border-[#35506d] bg-[#0f1b29] p-4">
          <div class="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#35506d] bg-[radial-gradient(circle_at_center,_rgba(201,155,24,0.12),_transparent_60%)]">
            <Camera :size="42" class="text-[#8e9bb0]" />
          </div>
          <div class="pointer-events-none absolute left-8 right-8 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-[#19c58a] to-transparent shadow-[0_0_14px_rgba(25,197,138,0.7)] animate-pulse"></div>
          <div class="mt-4 flex items-center gap-2 text-xs text-[#8e9bb0]">
            <ScanLine :size="16" class="text-[#19c58a]" />
            {{ scanning ? '摄像头已开启，正在模拟识别二维码...' : '已完成解析，可继续处理结果' }}
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="text-base font-bold">模拟二维码内容</h3>
        <div class="mt-4 space-y-3">
          <button
            v-for="item in scanItems"
            :key="item.code"
            @click="parseCode(item.code)"
            class="w-full rounded-2xl border px-4 py-3 text-left btn-interact"
            :class="selectedCode === item.code ? 'border-[#c99b18] bg-[#1e2d3d]' : 'border-[#273647] bg-[#13202c]'"
          >
            <p class="text-sm font-bold">{{ item.title }}</p>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ item.subtitle }}</p>
          </button>
        </div>
      </section>

      <section v-if="result" class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="flex items-start gap-3">
          <CheckCircle2 :size="20" class="mt-0.5 text-[#19c58a]" />
          <div>
            <h3 class="text-base font-bold">{{ result.title }}</h3>
            <p class="mt-2 text-sm text-[#d7e0ea]">{{ result.description }}</p>
          </div>
        </div>
        <button @click="handleAction" class="mt-4 w-full rounded-2xl bg-[#c99b18] px-4 py-3 text-sm font-bold text-white btn-interact">
          {{ parsing ? '解析中...' : result.actionLabel }}
        </button>
      </section>
    </div>
  </div>
</template>
