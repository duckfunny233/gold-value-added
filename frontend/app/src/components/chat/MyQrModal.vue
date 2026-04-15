<script setup>
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Copy, QrCode } from 'lucide-vue-next'
import { ChatService } from '../../services/chat'
import { showToast } from '../../composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])
const { t } = useI18n()

const qrData = ref(null)
const loading = ref(false)

const loadQr = async () => {
  if (!props.visible) return
  loading.value = true
  try {
    const response = await ChatService.getMyQrCode()
    qrData.value = response.data
  } finally {
    loading.value = false
  }
}

const copyUid = async () => {
  if (!qrData.value?.uid) return
  try {
    await navigator.clipboard.writeText(qrData.value.uid)
    showToast(t('chat.myQr.copySuccess'))
  } catch (error) {
    showToast(t('chat.myQr.copyFailed'))
  }
}

watch(() => props.visible, (value) => {
  if (value) loadQr()
})

onMounted(loadQr)
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[120] flex items-center justify-center px-6">
      <div class="absolute inset-0 bg-black/65" @click="emit('close')"></div>
      <div class="relative w-full max-w-sm rounded-3xl border border-[#304255] bg-[#162331] p-6 text-white shadow-2xl">
        <button @click="emit('close')" class="absolute right-4 top-4 text-[#8e9bb0] btn-interact">
          <X :size="20" />
        </button>

        <div class="flex items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#223244] text-[#c99b18]">
            <QrCode :size="24" />
          </div>
          <div>
            <h3 class="text-lg font-bold">{{ t('chat.myQr.title') }}</h3>
            <p class="text-xs text-[#8e9bb0]">{{ t('chat.myQr.desc') }}</p>
          </div>
        </div>

        <div class="mt-6 rounded-3xl bg-white p-4">
          <div v-if="loading" class="flex h-[220px] items-center justify-center text-sm text-slate-500">
            {{ t('common.loading') }}
          </div>
          <img v-else-if="qrData?.qrCode" :src="qrData.qrCode" :alt="t('chat.myQr.title')" class="mx-auto h-[220px] w-[220px] object-contain" />
        </div>

        <div class="mt-4 rounded-2xl bg-[#1d2c3d] p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-base font-bold">{{ qrData?.nickname || 'GoldInvestor_888' }}</p>
              <p class="mt-1 text-xs text-[#8e9bb0]">{{ t('chat.myQr.uidLabel') }}{{ qrData?.uid || 'U0001001' }}</p>
            </div>
            <button @click="copyUid" class="rounded-xl border border-[#3a4e64] px-3 py-1.5 text-xs text-[#d8e2ee] btn-interact">
              {{ t('chat.myQr.copyUid') }}
            </button>
          </div>
          <ul class="mt-3 space-y-1 text-xs text-[#8e9bb0]">
            <li v-for="tip in (qrData?.tips || [])" :key="tip">{{ tip }}</li>
          </ul>
        </div>
      </div>
    </div>
  </teleport>
</template>
