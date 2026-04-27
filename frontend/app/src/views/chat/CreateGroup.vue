<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, CheckCircle2, Users, Search, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { ChatService } from '../../services/chat'

const router = useRouter()
const { t } = useI18n()
const loading = ref(false)
const candidates = ref([])
const filteredCandidates = ref([])
const selectedIds = ref([])
const groupName = ref(t('chat.createGroupPage.defaultName'))
const notice = ref(t('chat.createGroupPage.defaultNotice'))
const createResult = ref(null)
const currentPage = ref(1)
const pageSize = ref(10)
const searchKeyword = ref('')

const selectedMembers = computed(() => candidates.value.filter((item) => selectedIds.value.includes(item.id)))
const canCreate = computed(() => groupName.value.trim() && selectedIds.value.length >= 2 && !createResult.value)

const totalPages = computed(() => {
  return Math.ceil(filteredCandidates.value.length / pageSize.value)
})

const paginatedCandidates = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredCandidates.value.slice(start, end)
})

const loadCandidates = async () => {
  loading.value = true
  try {
    const response = await ChatService.getGroupCandidates()
    candidates.value = response.data || []
    filteredCandidates.value = candidates.value
    selectedIds.value = candidates.value.slice(0, 2).map((item) => item.id)
  } catch (error) {
    console.error('Load group candidates failed:', error)
    candidates.value = []
    filteredCandidates.value = []
    selectedIds.value = []
  } finally {
    loading.value = false
  }
}

const toggleMember = (id) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((item) => item !== id)
    return
  }
  selectedIds.value = [...selectedIds.value, id]
}

const createGroup = async () => {
  try {
    const response = await ChatService.createGroup({
      name: groupName.value,
      notice: notice.value,
      memberIds: selectedIds.value,
    })
    createResult.value = response.data
  } catch (error) {
    console.error('Create group failed:', error)
  }
}

const enterGroupChat = () => {
  if (!createResult.value?.chatId) return
  router.replace({
    path: `/chat/${createResult.value.chatId}`,
    query: { title: createResult.value.name || groupName.value || t('chat.createGroupPage.newGroup') },
  })
}

const searchMembers = () => {
  if (!searchKeyword.value.trim()) {
    filteredCandidates.value = candidates.value
  } else {
    const keyword = searchKeyword.value.toLowerCase()
    filteredCandidates.value = candidates.value.filter(item => {
      return item.nickname.toLowerCase().includes(keyword) || item.uid.includes(keyword)
    })
  }
  currentPage.value = 1
}

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

watch(searchKeyword, (newKeyword) => {
  if (newKeyword.trim() === '') {
    searchMembers()
  }
})

onMounted(loadCandidates)
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <div>
        <h2 class="text-lg font-bold">{{ t('chat.createGroup') }}</h2>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-4">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="space-y-3">
          <label class="block text-sm">
            <span class="mb-2 block text-[#8e9bb0]">{{ t('chat.createGroupPage.groupName') }}</span>
            <input v-model="groupName" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none" />
          </label>
          <label class="block text-sm">
            <span class="mb-2 block text-[#8e9bb0]">{{ t('chat.createGroupPage.notice') }}</span>
            <textarea v-model="notice" rows="3" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none"></textarea>
          </label>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold">{{ t('chat.createGroupPage.selectMembers') }}</h3>
          <span class="text-xs text-[#c99b18]">{{ t('chat.createGroupPage.selectedCount', { count: selectedIds.length }) }}</span>
        </div>
        
        <div class="mt-3">
          <div class="flex items-center gap-3 rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3">
            <Search :size="18" class="text-[#8e9bb0]" />
            <input v-model="searchKeyword" @keyup.enter="searchMembers" :placeholder="t('chat.createGroupPage.searchPlaceholder')" class="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6f8093]" />
            <button @click="searchMembers" class="rounded-xl bg-[#c99b18] px-3 py-1.5 text-xs font-bold text-white btn-interact">
              {{ t('common.search') }}
            </button>
          </div>
        </div>
        
        <div class="mt-4 grid grid-cols-1 gap-3">
          <button
            v-for="item in paginatedCandidates"
            :key="item.id"
            @click="toggleMember(item.id)"
            class="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left btn-interact"
            :class="selectedIds.includes(item.id) ? 'border-[#c99b18] bg-[#1e2d3d]' : 'border-[#273647] bg-[#13202c]'"
          >
            <img :src="item.avatar" class="h-11 w-11 rounded-full bg-[#223244]" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold">{{ item.nickname }}</p>
              <p class="mt-1 text-xs text-[#8e9bb0]">{{ item.uid }} · {{ item.role }}</p>
            </div>
            <span class="text-xs" :class="selectedIds.includes(item.id) ? 'text-[#c99b18]' : 'text-[#7a8ca1]'">
              {{ selectedIds.includes(item.id) ? t('chat.createGroupPage.selected') : t('chat.createGroupPage.select') }}
            </span>
          </button>
        </div>
        
        <div v-if="totalPages > 1" class="mt-4 flex items-center justify-center gap-2">
          <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1" class="flex items-center justify-center h-8 w-8 rounded-full border border-[#273647] bg-[#13202c] text-[#8e9bb0] btn-interact" :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }">
            <ChevronLeft :size="16" />
          </button>
          <span class="text-xs text-[#8e9bb0]">{{ currentPage }} / {{ totalPages }}</span>
          <button @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages" class="flex items-center justify-center h-8 w-8 rounded-full border border-[#273647] bg-[#13202c] text-[#8e9bb0] btn-interact" :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }">
            <ChevronRight :size="16" />
          </button>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="text-base font-bold">{{ t('chat.createGroupPage.selectedMembers') }}</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="item in selectedMembers" :key="item.id" class="rounded-full bg-[#223244] px-3 py-1 text-xs text-[#dce6f0]">
            {{ item.nickname }}
          </span>
        </div>
        <button
          v-if="canCreate"
          @click="createGroup"
          class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact"
        >
          <Users :size="18" />
          {{ t('chat.createGroup') }}
        </button>
      </section>

      <section v-if="createResult" class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="flex items-center gap-3 text-[#34d399]">
          <CheckCircle2 :size="20" />
          <div>
            <p class="font-bold">{{ t('chat.createGroupPage.created') }}</p>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ t('chat.createGroupPage.createdDesc', { name: createResult.name, count: createResult.memberCount }) }}</p>
          </div>
        </div>
        <button @click="enterGroupChat" class="mt-4 w-full rounded-2xl bg-[#c99b18] px-4 py-3 text-sm font-bold text-white btn-interact">
          {{ t('chat.createGroupPage.enterGroup') }}
        </button>
      </section>
    </div>
  </div>
</template>
