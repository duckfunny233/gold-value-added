<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Smile, Mic, Plus, Send } from 'lucide-vue-next'
import { ChatService } from '../services/chat'
import { useChatScroll } from '../composables/useChatScroll'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const message = ref('')
const inputBar = ref(null)
const chatContainer = ref(null)
const showEmoji = ref(false)
const chatList = ref([])
const chatTitle = ref('鐎电鐦界拠锔藉剰')
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)

const { scrollToBottom, handleLoadMoreScroll } = useChatScroll(chatContainer)

const chatId = computed(() => route.params.id)
let pollTimer = null

const emojis = ['😀', '😁', '😄', '❤️', '👏', '🙏', '🔥', '💰', '🚀', '🙂', '😎', '🤝', '✅', '🎉', '👍', '📈']

const fetchMessages = async (isLoadMore = false, isSilent = false) => {
  if (loading.value && !isSilent) return
  
  if (!isSilent) loading.value = true
  // 鐠佹澘缍嶉崝鐘烘祰閸撳秶娈戝姘З妤傛ê瀹?  const oldHeight = chatContainer.value ? chatContainer.value.scrollHeight : 0
  
  try {
    const json = await ChatService.getMessages(chatId.value, isLoadMore ? page.value : 1, 20)
    
    if (isLoadMore) {
      chatList.value = [...json.data.items, ...chatList.value]
      handleLoadMoreScroll(oldHeight)
    } else {
      // 濡偓閺屻儲妲搁崥锔芥箒閺傜増绉烽幁?
      const hasNew = json.data.items.length > 0 && 
                     (chatList.value.length === 0 || 
                      json.data.items[json.data.items.length - 1].id !== chatList.value[chatList.value.length - 1].id)
      
      if (hasNew) {
        chatList.value = json.data.items
        // 閸欘亝婀侀崷銊╂饯姒涙ê鍩涢弬棰佺瑬閻劍鍩涢崷銊ョ俺闁劑妾潻鎴炴閹靛秷鍤滈崝銊︾泊閸?
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
  if (hasMore.value) {
    page.value++
    fetchMessages(true)
  }
}

const fetchChatInfo = async () => {
  try {
    const json = await ChatService.getChatList()
    const chat = json.data.find(c => c.id === parseInt(chatId.value))
    if (chat) chatTitle.value = chat.name
  } catch (err) {
    console.error('Failed to fetch chat info:', err)
  }
}

const sendMessage = async (text = null) => {
  const content = text || message.value
  if (typeof content !== 'string' || !content.trim()) return

  try {
    const json = await ChatService.sendMessage(parseInt(chatId.value), content)
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
  
  // 瀵偓閸氼垵鐤嗙拠顫窗濮?缁夋帗濯洪崣鏍︾濞嗏剝娓堕弬鐗堢Х閹?
  pollTimer = setInterval(() => {
    fetchMessages(false, true)
  }, 5000)
})

onUnmounted(() => {
  window.removeEventListener('resize', scrollToBottom)
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col z-[100]">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-4 shrink-0 relative z-10">
      <button @click="router.back()" class="p-1 -ml-1 text-gray-600 dark:text-gray-400 btn-interact rounded-full">
        <ArrowLeft :size="24" />
      </button>
      <h3 class="font-bold text-lg">{{ chatTitle }}</h3>
    </header>

    <!-- Messages -->
    <div
      ref="chatContainer"
      id="chat-container"
      class="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar"
    >
      <!-- Load More Button -->
      <div v-if="hasMore" class="flex justify-center pb-2">
        <button 
          @click="loadMore" 
          class="text-[10px] text-primary bg-primary/10 px-4 py-1.5 rounded-full btn-interact font-bold uppercase tracking-wider"
          :disabled="loading"
        >
          {{ loading ? t('chat.syncing') : t('chat.loadMore') }}
        </button>
      </div>

      <div v-for="msg in chatList" :key="msg.id"
        class="flex flex-col animate-in fade-in slide-in-from-bottom-1 duration-300"
        :class="msg.self ? 'items-end' : 'items-start'"
      >
        <div class="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm"
          :class="msg.self ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-gray-700/50'"
        >
          {{ msg.text }}
        </div>
        <span class="text-[9px] text-gray-400 mt-1 font-medium px-1 tabular-nums">{{ msg.time }}</span>
      </div>
    </div>

    <!-- Input Bar -->
    <div
      ref="inputBar"
      class="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4 pb-8 shrink-0"
    >
      <div class="flex items-center gap-3">
        <div class="flex-1 bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-2.5 flex items-center gap-2 border border-gray-100 dark:border-gray-700/50">
          <input
            v-model="message"
            @keyup.enter="sendMessage"
            @focus="handleInputFocus"
            type="text"
            :placeholder="t('chat.placeholder')"
            class="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm dark:text-gray-200"
          />
          <button 
            @click="showEmoji = !showEmoji"
            class="transition-all btn-interact"
            :class="showEmoji ? 'text-primary' : 'text-gray-400'"
          >
            <Smile :size="20" />
          </button>
        </div>
        <button 
          @click="sendMessage()" 
          class="transition-all btn-interact"
          :class="message.trim() ? 'text-primary' : 'text-gray-300'"
        >
          <Send :size="24" />
        </button>
      </div>

      <!-- Emoji Picker -->
      <div v-if="showEmoji" class="mt-4 grid grid-cols-8 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl">
        <button 
          v-for="emoji in emojis" 
          :key="emoji"
          @click="selectEmoji(emoji)"
          class="text-2xl hover:bg-white dark:hover:bg-gray-800 rounded-xl p-1 transition-all btn-interact"
        >
          {{ emoji }}
        </button>
      </div>
    </div>
  </div>
</template>
