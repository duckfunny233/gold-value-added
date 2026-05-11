<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Search, UserPlus, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { ChatService } from '../../services/chat'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const keyword = ref(route.query.keyword || '')
const loading = ref(false)
const searching = ref(false)
const results = ref([])
const selectedUser = ref(null)
const requestState = ref(null)
const confirmLoading = ref(false)
const visibleCount = ref(5)
const searched = ref(false)

const canSendRequest = computed(() => selectedUser.value && !requestState.value)
const isRecommendationMode = computed(() => String(keyword.value || '').trim().length === 0)

const sortedResults = computed(() => {
  return [...results.value].sort((a, b) => b.mutualFriends - a.mutualFriends)
})

const hasMore = computed(() => {
  return sortedResults.value.length > visibleCount.value
})

const isExpanded = computed(() => {
  return visibleCount.value > 5
})

const searchUsers = async () => {
  searching.value = true
  searched.value = true
  visibleCount.value = 5
  try {
    const response = await ChatService.searchFriends(keyword.value)
    results.value = response.data || []
    selectedUser.value = results.value.length ? results.value[0] : null
    requestState.value = null
  } catch (error) {
    console.error('Search friends failed:', error)
    results.value = []
    selectedUser.value = null
    requestState.value = null
  } finally {
    searching.value = false
  }
}

const loadProfile = async (id) => {
  loading.value = true
  try {
    const response = await ChatService.getFriendProfile(id)
    selectedUser.value = response.data
    requestState.value = null
  } catch (error) {
    console.error('Load friend profile failed:', error)
  } finally {
    loading.value = false
  }
}

const sendRequest = async () => {
  if (!selectedUser.value) return
  try {
    const response = await ChatService.sendFriendRequest({
      targetUserId: selectedUser.value.id,
      message: t('chat.addFriendPage.requestMessage'),
    })
    requestState.value = response.data
  } catch (error) {
    console.error('Send friend request failed:', error)
  }
}

const confirmRequest = async () => {
  if (!requestState.value?.requestId) return
  confirmLoading.value = true
  try {
    const response = await ChatService.confirmFriendRequest(requestState.value.requestId)
    requestState.value = {
      ...requestState.value,
      ...response.data,
    }
  } catch (error) {
    console.error('Confirm friend request failed:', error)
  } finally {
    confirmLoading.value = false
  }
}

const openChat = () => {
  if (!requestState.value?.chatId) return
  router.replace({
    path: `/chat/${requestState.value.chatId}`,
    query: { title: requestState.value.chatName || selectedUser.value?.nickname || t('chat.addFriendPage.newFriend') },
  })
}

const loadMore = () => {
  visibleCount.value += 5
}

const collapse = () => {
  visibleCount.value = 5
}

onMounted(async () => {
  await searchUsers()
  if (route.query.targetId) {
    await loadProfile(route.query.targetId)
  }
})
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <div>
        <h2 class="text-lg font-bold">{{ t('chat.addFriend') }}</h2>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 pb-8">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="flex items-center gap-3 rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3">
          <Search :size="18" class="text-[#8e9bb0]" />
          <input v-model="keyword" @keyup.enter="searchUsers" :placeholder="t('chat.addFriendPage.searchPlaceholder')" class="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f8093]" />
          <button @click="searchUsers" class="rounded-xl bg-[#c99b18] px-3 py-1.5 text-xs font-bold text-white btn-interact">
            {{ searching ? t('chat.addFriendPage.searching') : t('common.search') }}
          </button>
        </div>
        <p v-if="searched && !searching && !isRecommendationMode && sortedResults.length === 0" class="mt-3 text-center text-sm text-[#8e9bb0]">
          该用户不存在
        </p>

        <div class="mt-4 space-y-3">
          <p v-if="isRecommendationMode && sortedResults.length > 0" class="text-sm font-bold text-[#cfd8e3]">
            可能认识的人
          </p>
          <button
            v-for="item in sortedResults.slice(0, visibleCount)"
            :key="item.id"
            @click="loadProfile(item.id)"
            class="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left btn-interact"
            :class="selectedUser?.id === item.id ? 'border-[#c99b18] bg-[#1e2d3d]' : 'border-[#273647] bg-[#13202c]'"
          >
            <img :src="item.avatar" class="h-11 w-11 rounded-full bg-[#223244]" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold">{{ item.nickname }}</p>
              <p class="mt-1 text-xs text-[#8e9bb0]">{{ item.uid }} · {{ t('chat.addFriendPage.mutualFriends', { count: item.mutualFriends }) }}</p>
            </div>
            <span class="text-xs text-[#c99b18]">{{ t('chat.addFriendPage.view') }}</span>
          </button>
          <div v-if="hasMore || isExpanded" class="flex justify-center gap-3">
            <button
              v-if="isExpanded"
              @click="collapse"
              class="flex items-center gap-2 rounded-2xl border border-[#273647] bg-[#13202c] px-4 py-3 text-sm text-[#c99b18] btn-interact"
            >
              <ChevronUp :size="16" />
              {{ t('chat.addFriendPage.collapse') }}
            </button>
            <button
              v-if="hasMore"
              @click="loadMore"
              class="flex items-center justify-center gap-2 rounded-2xl border border-[#273647] bg-[#13202c] px-4 py-3 text-sm text-[#c99b18] btn-interact"
            >
              <ChevronDown :size="16" />
              {{ t('chat.addFriendPage.loadMore') }}
            </button>
          </div>
        </div>
      </section>

      <section v-if="selectedUser" class="mt-4 rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="flex items-start gap-4">
          <img :src="selectedUser.avatar" class="h-14 w-14 rounded-full bg-[#223244]" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold">{{ selectedUser.nickname }}</h3>
              <span class="rounded-full bg-[#223244] px-2 py-0.5 text-[10px] text-[#c99b18]">{{ selectedUser.status }}</span>
            </div>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ t('chat.myQr.uidLabel') }}{{ selectedUser.uid }} · {{ t('chat.addFriendPage.cityLabel') }}{{ selectedUser.city }}</p>
            <p class="mt-3 text-sm text-[#d7e0ea]">{{ selectedUser.intro }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span v-for="tag in selectedUser.tags" :key="tag" class="rounded-full border border-[#35506d] px-2 py-1 text-[10px] text-[#a9bbd0]">{{ tag }}</span>
            </div>
          </div>
        </div>

        <button
          v-if="canSendRequest"
          @click="sendRequest"
          class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c99b18] px-4 py-3 text-sm font-bold text-white btn-interact"
        >
          <UserPlus :size="18" />
          {{ t('chat.addFriendPage.sendRequest') }}
        </button>
      </section>

      <section v-if="requestState" class="mt-4 rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="text-base font-bold">{{ t('chat.addFriendPage.progress') }}</h3>
        <div class="mt-4 space-y-3 text-sm">
          <div class="flex items-center gap-3 text-[#34d399]">
            <CheckCircle2 :size="18" />
            <span>{{ t('chat.addFriendPage.requestSent', { name: selectedUser?.nickname }) }}</span>
          </div>
          <div class="rounded-2xl bg-[#101b28] p-3 text-xs text-[#8e9bb0]">
            {{ t('chat.addFriendPage.messageLabel') }}{{ requestState.message }}
          </div>
          <div v-if="requestState.status === 'accepted'" class="rounded-2xl border border-[#245140] bg-[#123326] px-4 py-3 text-sm text-[#b7f7d5]">
            {{ t('chat.addFriendPage.accepted') }}
          </div>
          <button
            v-else
            @click="confirmRequest"
            class="w-full rounded-2xl border border-[#35506d] px-4 py-3 text-sm font-bold text-[#dce6f0] btn-interact"
          >
            {{ confirmLoading ? t('chat.addFriendPage.confirming') : t('chat.addFriendPage.simulateConfirm') }}
          </button>
          <button
            v-if="requestState.status === 'accepted'"
            @click="openChat"
            class="w-full rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact"
          >
            {{ t('chat.addFriendPage.sendMessage') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
