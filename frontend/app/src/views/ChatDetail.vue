<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Smile, Send, Plus } from 'lucide-vue-next'
import { ChatService } from '../services/chat'
import { useChatScroll } from '../composables/useChatScroll'
import TransferModal from '../components/chat/TransferModal.vue'
import { showToast } from '../composables/useToast'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const message = ref('')
const inputBar = ref(null)
const chatContainer = ref(null)
const showEmoji = ref(false)
const showTransferModal = ref(false)
const chatList = ref([])
const chatTitle = ref(route.query.title || t('chat.detailTitle'))
const chatType = ref('user')
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)

const { scrollToBottom, handleLoadMoreScroll } = useChatScroll(chatContainer)

const chatId = computed(() => route.params.id)
const canOpenTransfer = computed(() => chatType.value !== 'system')
let pollTimer = null

const emojis = ['😀', '😁', '😄', '❤️', '👏', '🙏', '🔥', '💰', '🚀', '🙂', '😎', '🤝', '✅', '🎉', '👍', '📈']

const translateMaybe = (value) => {
  if (typeof value !== 'string' || !value) return value
  const translated = t(value)
  return translated !== value ? translated : value
}

const normalizeTime = (value, timeKey = '') => {
  if (timeKey) return t(timeKey)
  const raw = String(value || '')
  if (raw === '昨天' || raw.toLowerCase() === 'yesterday') return t('chat.timeYesterday')
  if (raw === '刚刚' || raw.toLowerCase() === 'just now') return t('chat.timeJustNow')
  return value
}

const localizeMessage = (item) => ({
  ...item,
  text: translateMaybe(item?.text),
  time: normalizeTime(item?.time, item?.timeKey),
})

const fetchMessages = async (isLoadMore = false, isSilent = false) => {
  if (loading.value && !isSilent) return
  if (!isSilent) loading.value = true

  const oldHeight = chatContainer.value ? chatContainer.value.scrollHeight : 0

  try {
    const json = await ChatService.getMessages(chatId.value, isLoadMore ? page.value : 1, 20)

    if (isLoadMore) {
      const pageItems = Array.isArray(json?.data?.items) ? json.data.items : []
      chatList.value = [...pageItems.map(localizeMessage), ...chatList.value]
      handleLoadMoreScroll(oldHeight)
    } else {
      const pageItems = Array.isArray(json?.data?.items) ? json.data.items : []
      const hasNew = pageItems.length > 0 &&
        (chatList.value.length === 0 || pageItems[pageItems.length - 1].id !== chatList.value[chatList.value.length - 1]?.id)

      if (hasNew || chatList.value.length === 0) {
        chatList.value = pageItems.map(localizeMessage)
        const isNearBottom = chatContainer.value &&
          (chatContainer.value.scrollHeight - chatContainer.value.scrollTop - chatContainer.value.clientHeight < 100)

        if (!isSilent || isNearBottom) {
          scrollToBottom()
        }
      }
    }

    hasMore.value = json.data.hasMore
  } catch (err) {
    console.error('Failed to fetch messages:', err)
  } finally {
    if (!isSilent) loading.value = false
  }
}

const loadMore = () => {
  if (!hasMore.value) return
  page.value += 1
  fetchMessages(true)
}

const fetchChatInfo = async () => {
  try {
    const json = await ChatService.getChatList()
    const chat = json.data.find((item) => String(item.id) === String(chatId.value))
    if (chat?.name) {
      chatTitle.value = translateMaybe(chat.nameKey ? t(chat.nameKey) : chat.name)
      chatType.value = chat.type || 'user'
      return
    }
    if (route.query.title) {
      chatTitle.value = route.query.title
    }
  } catch (err) {
    console.error('Failed to fetch chat info:', err)
    if (route.query.title) {
      chatTitle.value = route.query.title
    }
  }
}

const sendMessage = async (text = null) => {
  const content = text || message.value
  if (typeof content !== 'string' || !content.trim()) return

  try {
    const json = await ChatService.sendMessage(parseInt(chatId.value, 10), content)
    chatList.value.push(json.data)
    if (!text) message.value = ''
    showEmoji.value = false
    scrollToBottom()
  } catch (err) {
    console.error('Failed to send message:', err)
  }
}

const selectEmoji = (emoji) => {
  sendMessage(emoji)
}

const openTransferModal = () => {
  if (!canOpenTransfer.value) {
    showToast(t('chat.systemNoTransfer'))
    return
  }
  showTransferModal.value = true
}

const translateTransferStatus = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'submitted' || status === '已提交') return t('chat.transfer.submitted')
  if (normalized === 'completed' || status === '已完成') return t('chat.transfer.completed')
  return status || t('chat.transfer.submitted')
}

const handleTransferSuccess = (transferMessage) => {
  chatList.value.push(transferMessage)
  scrollToBottom()
}

const handleInputFocus = () => {
  setTimeout(() => {
    if (inputBar.value) {
      inputBar.value.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    scrollToBottom()
  }, 300)
}

onMounted(() => {
  fetchMessages()
  fetchChatInfo()
  window.addEventListener('resize', scrollToBottom)

  pollTimer = setInterval(() => {
    fetchMessages(false, true)
    fetchChatInfo()
  }, 5000)
})

onUnmounted(() => {
  window.removeEventListener('resize', scrollToBottom)
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="shrink-0 border-b border-[#233242] bg-[#1a2735] px-4 py-3 flex items-center gap-4">
      <button @click="router.back()" class="rounded-full p-1 -ml-1 text-[#9fb0c3] btn-interact">
        <ArrowLeft :size="24" />
      </button>
      <h3 class="text-lg font-bold truncate">{{ chatTitle }}</h3>
    </header>

    <div
      ref="chatContainer"
      id="chat-container"
      class="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-[#0f1824]"
    >
      <div v-if="hasMore" class="flex justify-center pb-2">
        <button
          @click="loadMore"
          class="rounded-full bg-[#162331] px-4 py-1.5 text-[10px] font-bold tracking-wider text-[#c99b18] btn-interact"
          :disabled="loading"
        >
          {{ loading ? t('chat.syncing') : t('chat.loadMore') }}
        </button>
      </div>

      <div
        v-for="msg in chatList"
        :key="msg.id"
        class="flex flex-col"
        :class="msg.self ? 'items-end' : 'items-start'"
      >
        <template v-if="msg.type === 'transfer'">
          <div class="w-[240px] rounded-3xl border border-[#2b4254] bg-[#132331] px-4 py-4 shadow-sm" :class="msg.self ? 'rounded-tr-none' : 'rounded-tl-none'">
            <div class="flex items-center justify-between text-xs text-[#8e9bb0]">
              <span>{{ t('chat.transfer.title') }}</span>
              <span class="text-[#19c58a]">{{ translateTransferStatus(msg.status) }}</span>
            </div>
            <p class="mt-3 text-3xl font-bold text-[#f6c23e]">¥{{ Number(msg.amount || 0).toFixed(2) }}</p>
            <p class="mt-3 text-sm text-[#dbe5ef]">{{ t('chat.transfer.recipientLabel') }}{{ msg.recipientName }}</p>
            <p v-if="msg.note" class="mt-1 text-xs text-[#8e9bb0]">{{ t('chat.transfer.noteLabel') }}{{ msg.note }}</p>
          </div>
        </template>
        <template v-else>
          <div
            class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm"
            :class="msg.self ? 'bg-[#c99b18] text-white rounded-tr-none' : 'bg-[#1a2735] text-[#ecf2f9] rounded-tl-none border border-[#273647]'"
          >
            {{ msg.text }}
          </div>
        </template>
        <span class="mt-1 px-1 text-[9px] font-medium tabular-nums text-[#7f90a4]">{{ msg.time }}</span>
      </div>
    </div>

    <div
      ref="inputBar"
      class="shrink-0 border-t border-[#233242] bg-[#1a2735] p-4 pb-8"
    >
      <div class="flex items-center gap-3">
        <div class="flex flex-1 items-center gap-2 rounded-2xl border border-[#273647] bg-[#101b28] px-4 py-2.5">
          <input
            v-model="message"
            @keyup.enter="sendMessage"
            @focus="handleInputFocus"
            type="text"
            :placeholder="t('chat.placeholder')"
            class="flex-1 bg-transparent border-none text-sm text-white focus:outline-none"
          />
          <button
            @click="showEmoji = !showEmoji"
            class="btn-interact transition-all"
            :class="showEmoji ? 'text-[#c99b18]' : 'text-[#8e9bb0]'"
          >
            <Smile :size="20" />
          </button>
        </div>
        <button
          v-if="message.trim()"
          @click="sendMessage()"
          class="btn-interact transition-all text-[#c99b18]"
        >
          <Send :size="24" />
        </button>
        <button
          v-else
          @click="openTransferModal"
          class="btn-interact transition-all text-[#8e9bb0] hover:text-[#c99b18]"
        >
          <Plus :size="24" />
        </button>
      </div>

      <div v-if="showEmoji" class="mt-4 grid grid-cols-8 gap-2 rounded-2xl bg-[#101b28] p-3">
        <button
          v-for="emoji in emojis"
          :key="emoji"
          @click="selectEmoji(emoji)"
          class="rounded-xl p-1 text-2xl transition-all btn-interact hover:bg-[#1a2735]"
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <TransferModal
      :visible="showTransferModal"
      :chat-id="chatId"
      :chat-title="chatTitle"
      :chat-type="chatType"
      @close="showTransferModal = false"
      @success="handleTransferSuccess"
    />
  </div>
</template>
