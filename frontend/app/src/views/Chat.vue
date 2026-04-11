<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Bell, User, Users, RefreshCw } from 'lucide-vue-next'
import { ChatService } from '../services/chat'
import MyQrModal from '../components/chat/MyQrModal.vue'

defineOptions({ name: 'Chat' })

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const chats = ref([])
const isRefreshing = ref(false)
const showQrModal = computed(() => route.query.modal === 'my-qr')

const iconMap = {
  system: Bell,
  user: User,
  group: Users
}

const fetchChats = async (silent = false) => {
  if (!silent) isRefreshing.value = true
  try {
    const json = await ChatService.getChatList()
    chats.value = json.data
  } catch (err) {
    console.error('Failed to fetch chats:', err)
  } finally {
    isRefreshing.value = false
  }
}

const handleRefresh = () => {
  fetchChats()
}

onMounted(() => {
  fetchChats()
})

watch(() => route.fullPath, () => {
  if (route.path === '/chat') {
    fetchChats(true)
  }
})

const openChat = (id) => {
  router.push(`/chat/${id}`)
}
</script>

<template>
  <div class="bg-[#0b1520] min-h-full flex flex-col text-white">
    <!-- Refresh Bar (Simulated Pull-to-refresh) -->
    <div 
      class="flex items-center justify-center py-2 bg-[#101b28] border-b border-[#233242] transition-all overflow-hidden"
      :class="isRefreshing ? 'h-10 opacity-100' : 'h-0 opacity-0'"
    >
      <RefreshCw class="animate-spin text-primary" :size="16" />
      <span class="ml-2 text-xs text-gray-400 font-medium">{{ t('chat.refreshing') }}</span>
    </div>

    <div v-if="chats.length === 0 && !isRefreshing" class="flex-1 flex flex-col items-center justify-center p-10 text-center">
      <div class="w-20 h-20 bg-[#162331] rounded-full flex items-center justify-center mb-4">
        <Users class="text-gray-300" :size="40" />
      </div>
      <p class="text-[#8e9bb0] font-medium">{{ t('chat.noSession') }}</p>
      <button @click="handleRefresh" class="mt-4 text-primary text-sm font-bold flex items-center gap-1">
        <RefreshCw :size="14" />
        {{ t('chat.reload') }}
      </button>
    </div>

    <div v-else class="flex-1 px-4">
      <div v-for="chat in chats" :key="chat.id" 
        @click="openChat(chat.id)"
        class="card-base mb-3 flex items-center gap-4 p-4 active:bg-[#1d2a38] transition-all btn-interact border-none shadow-sm bg-[#162331]"
      >
        <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner"
          :class="chat.type === 'system' ? 'bg-blue-100 text-blue-600' : (chat.type === 'group' ? 'bg-green-100 text-green-600' : 'bg-[#223244] text-[#b8c4d3]')"
        >
          <component :is="iconMap[chat.type]" :size="24" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-baseline mb-1">
            <h4 class="font-bold truncate text-sm">{{ chat.name }}</h4>
            <span class="text-[10px] text-[#8e9bb0] font-medium tabular-nums">{{ chat.time }}</span>
          </div>
          <p class="text-xs text-[#8e9bb0] truncate">{{ chat.lastMsg }}</p>
        </div>
      </div>
    </div>

    <MyQrModal :visible="showQrModal" @close="router.replace('/chat')" />
  </div>
</template>
