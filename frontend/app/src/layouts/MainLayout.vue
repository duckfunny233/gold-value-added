<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Logo from '../components/Logo.vue'
import DropdownButton from '../components/common/DropdownButton.vue'
import { Home, MessageSquare, TrendingUp, Landmark, User, Plus, UserPlus, Users, Globe, Scan, QrCode } from 'lucide-vue-next'

defineOptions({ name: 'MainLayout' })

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
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
  { label: 'English', action: 'en' },
  { label: '简体中文', action: 'zh' },
  { label: '日本語', action: 'ja' },
  { label: 'Русский', action: 'ru' },
  { label: 'Español', action: 'es' },
  { label: 'हिन्दी', action: 'hi' },
  { label: 'العربية', action: 'ar' }
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
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <keep-alive :include="['Home', 'Chat', 'Market', 'Profile']">
            <component :is="Component" />
          </keep-alive>
        </transition>
      </router-view>
    </main>

    <nav class="fixed bottom-0 left-0 right-0 bg-[#101b28] border-t border-[#233242] flex justify-around items-center py-2 px-1 z-50">
      <button
        v-for="item in navItems"
        :key="item.path"
        @click="router.push(item.path)"
        class="flex flex-col items-center gap-1 transition-colors flex-1 py-1"
        :class="route.path === item.path ? 'text-primary' : 'text-[#8e9bb0]'"
      >
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
