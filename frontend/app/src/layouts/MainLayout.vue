<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Logo from '../components/Logo.vue'
import DropdownButton from '../components/common/DropdownButton.vue'
import { ChatService } from '../services/chat'
import { Home, MessageSquare, TrendingUp, Landmark, User, Plus, UserPlus, Users, Globe, Scan, QrCode } from 'lucide-vue-next'

defineOptions({ name: 'MainLayout' })

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const chatUnread = ref(0)
let unreadTimer = null
const navItems = computed(() => [
  { name: t('nav.home'), path: '/home', icon: Home },
  { name: t('nav.chat'), path: '/chat', icon: MessageSquare },
  { name: t('nav.market'), path: '/market', icon: TrendingUp },
  { name: t('nav.trade'), path: '/trade', icon: Landmark },
  { name: t('nav.profile'), path: '/profile', icon: User }
])

const chatMenuItems = computed(() => [
  { label: t('chat.addFriend'), icon: UserPlus, action: 'addFriend' },
  { label: t('chat.createGroup'), icon: Users, action: 'createGroup' },
  { label: t('chat.scan'), icon: Scan, action: 'scan' },
  { label: t('chat.qrCode'), icon: QrCode, action: 'qrCode' }
])

const langMenuItems = computed(() => [
  { label: '简体中文', action: 'zh' },
  { label: 'English', action: 'en' },
  { label: 'Español', action: 'es' },
  { label: 'العربية', action: 'ar' },
  { label: 'हिन्दी', action: 'hi' },
  { label: 'Русский', action: 'ru' },
  { label: '日本語', action: 'ja' },
  { label: 'Português', action: 'pt' },
  { label: 'বাংলা', action: 'bn' }
])

const handleChatMenu = (item) => {
  if (item.action === 'addFriend') {
    router.push('/chat/add-friend')
    return
  }

  if (item.action === 'createGroup') {
    router.push('/chat/create-group')
    return
  }

  if (item.action === 'scan') {
    router.push('/chat/scan')
    return
  }

  if (item.action === 'qrCode') {
    router.push({ path: '/chat', query: { modal: 'my-qr' } })
    return
  }
}

const handleLangMenu = (item) => {
  locale.value = item.action
  localStorage.setItem('locale', item.action)
}

const refreshUnread = async () => {
  try {
    const response = await ChatService.getChatList()
    const list = Array.isArray(response?.data) ? response.data : []
    chatUnread.value = list.reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0)
  } catch (error) {
    console.error('Load chat unread failed:', error)
  }
}

onMounted(() => {
  refreshUnread()
  unreadTimer = setInterval(refreshUnread, 5000)
})

onUnmounted(() => {
  if (unreadTimer) clearInterval(unreadTimer)
})

watch(() => route.fullPath, () => {
  refreshUnread()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-[#0b1520] text-white overflow-hidden">
    <header class="bg-[#1a2735] border-b border-[#2a3a4b] px-4 py-3 shrink-0 flex justify-between items-center relative text-white">
      <Logo />

      <DropdownButton
        v-if="route.path === '/chat'"
        :icon="Plus"
        :items="chatMenuItems"
        @select="handleChatMenu"
      />

      <DropdownButton
        v-if="route.path === '/home'"
        :icon="Globe"
        :items="langMenuItems"
        @select="handleLangMenu"
      />
    </header>

    <main class="flex-1 overflow-y-auto pb-20 bg-[#0b1520]">
      <router-view v-slot="{ Component, route: currentRoute }">
        <transition name="fade">
          <keep-alive :include="['Home', 'Chat', 'Market', 'Trade', 'Profile']">
            <component :is="Component" :key="currentRoute.name || currentRoute.path" />
          </keep-alive>
        </transition>
      </router-view>
    </main>

    <nav class="fixed bottom-0 left-0 right-0 bg-[#101b28] border-t border-[#233242] flex justify-around items-center py-2 px-1 z-50">
      <button
        v-for="item in navItems"
        :key="item.path"
        @click="router.push(item.path)"
        class="relative flex flex-col items-center gap-1 transition-colors flex-1 py-1"
        :class="route.path === item.path ? 'text-primary' : 'text-[#8e9bb0]'"
      >
        <span
          v-if="item.path === '/chat' && chatUnread > 0"
          class="absolute top-0 right-[28%] min-w-[18px] h-[18px] rounded-full bg-[#ef4444] px-1 text-[10px] leading-[18px] text-white text-center font-bold"
        >
          {{ chatUnread > 99 ? '99+' : chatUnread }}
        </span>
        <component :is="item.icon" :size="20" />
        <span class="text-xs">{{ item.name }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
