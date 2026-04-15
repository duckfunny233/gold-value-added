<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Wallet, ChevronRight } from 'lucide-vue-next'
import { ChatService } from '../../services/chat'
import { showToast } from '../../composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  chatId: {
    type: [String, Number],
    required: true,
  },
  chatTitle: {
    type: String,
    default: '',
  },
  chatType: {
    type: String,
    default: 'user',
  },
})

const emit = defineEmits(['close', 'success'])
const { t } = useI18n()

const loading = ref(false)
const submitting = ref(false)
const targets = ref([])
const selectedTargetId = ref('')
const amount = ref('')
const note = ref('')

const isGroupChat = computed(() => props.chatType === 'group')
const selectedTarget = computed(() => targets.value.find((item) => String(item.id) === String(selectedTargetId.value)) || null)
const canSubmit = computed(() => {
  const amountValue = Number(amount.value)
  return amountValue > 0 && selectedTarget.value && !submitting.value
})

const resetForm = () => {
  amount.value = ''
  note.value = ''
  selectedTargetId.value = ''
}

const loadTargets = async () => {
  if (!props.visible) return
  loading.value = true
  try {
    const response = await ChatService.getTransferTargets(props.chatId, props.chatType, props.chatTitle)
    targets.value = response.data || []
    if (targets.value.length === 1) {
      selectedTargetId.value = targets.value[0].id
    }
  } finally {
    loading.value = false
  }
}

const submitTransfer = async () => {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const response = await ChatService.sendTransfer(props.chatId, {
      recipientId: selectedTarget.value.id,
      recipientName: selectedTarget.value.nickname,
      amount: Number(amount.value),
      note: note.value.trim(),
      chatType: props.chatType,
    })
    showToast(t('chat.transfer.sentToast'))
    emit('success', response.data)
    emit('close')
    resetForm()
  } finally {
    submitting.value = false
  }
}

watch(() => props.visible, (value) => {
  if (value) {
    loadTargets()
    return
  }
  resetForm()
})
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[120] flex items-end justify-center">
      <div class="absolute inset-0 bg-black/65" @click="emit('close')"></div>
      <div class="relative w-full rounded-t-[28px] border border-[#304255] bg-[#162331] p-5 text-white shadow-2xl">
        <button @click="emit('close')" class="absolute right-4 top-4 text-[#8e9bb0] btn-interact">
          <X :size="20" />
        </button>

        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#223244] text-[#c99b18]">
            <Wallet :size="22" />
          </div>
          <div>
            <h3 class="text-lg font-bold">{{ t('chat.transfer.title') }}</h3>
            <p class="text-xs text-[#8e9bb0]">{{ isGroupChat ? t('chat.transfer.groupDesc') : t('chat.transfer.singleDesc', { name: chatTitle || t('chat.transfer.currentFriend') }) }}</p>
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <div v-if="loading" class="rounded-2xl bg-[#101b28] px-4 py-5 text-sm text-[#8e9bb0]">
            {{ t('chat.transfer.loadingTargets') }}
          </div>

          <div v-else>
            <label class="mb-2 block text-xs text-[#8e9bb0]">{{ isGroupChat ? t('chat.transfer.groupReceiver') : t('chat.transfer.receiver') }}</label>
            <div v-if="isGroupChat" class="space-y-3">
              <button
                v-for="item in targets"
                :key="item.id"
                @click="selectedTargetId = item.id"
                class="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left btn-interact"
                :class="String(selectedTargetId) === String(item.id) ? 'border-[#c99b18] bg-[#1e2d3d]' : 'border-[#273647] bg-[#101b28]'"
              >
                <img :src="item.avatar" class="h-10 w-10 rounded-full bg-[#223244]" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-bold">{{ item.nickname }}</p>
                  <p class="mt-1 text-xs text-[#8e9bb0]">{{ item.uid }}</p>
                </div>
                <ChevronRight :size="16" class="text-[#7f90a4]" />
              </button>
            </div>

            <div v-else-if="selectedTarget" class="rounded-2xl border border-[#273647] bg-[#101b28] px-4 py-3">
              <div class="flex items-center gap-3">
                <img :src="selectedTarget.avatar" class="h-10 w-10 rounded-full bg-[#223244]" />
                <div>
                  <p class="text-sm font-bold">{{ selectedTarget.nickname }}</p>
                  <p class="mt-1 text-xs text-[#8e9bb0]">{{ selectedTarget.uid }}</p>
                </div>
              </div>
            </div>
          </div>

          <label class="block">
            <span class="mb-2 block text-xs text-[#8e9bb0]">{{ t('chat.transfer.amount') }}</span>
            <div class="flex items-center rounded-2xl border border-[#273647] bg-[#101b28] px-4 py-3">
              <span class="mr-3 text-lg font-bold text-[#c99b18]">¥</span>
              <input v-model="amount" type="number" min="0" step="0.01" :placeholder="t('chat.transfer.amountPlaceholder')" class="flex-1 bg-transparent text-white outline-none placeholder:text-[#66778b]" />
            </div>
          </label>

          <label class="block">
            <span class="mb-2 block text-xs text-[#8e9bb0]">{{ t('chat.transfer.note') }}</span>
            <input v-model="note" type="text" :placeholder="t('chat.transfer.notePlaceholder')" class="w-full rounded-2xl border border-[#273647] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#66778b]" />
          </label>
        </div>

        <button
          @click="submitTransfer"
          class="mt-6 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white btn-interact"
          :class="canSubmit ? 'bg-[#19c58a]' : 'bg-[#27445a] text-[#6d8399]'"
          :disabled="!canSubmit"
        >
          {{ submitting ? t('chat.transfer.processing') : t('chat.transfer.confirm') }}
        </button>
      </div>
    </div>
  </teleport>
</template>
