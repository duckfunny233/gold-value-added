<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, CheckCircle2, Users } from 'lucide-vue-next'
import { ChatService } from '../../services/chat'

const router = useRouter()
const loading = ref(false)
const candidates = ref([])
const selectedIds = ref([])
const groupName = ref('贵金属快讯群')
const notice = ref('关注盘中资讯与上金所节奏同步')
const createResult = ref(null)

const selectedMembers = computed(() => candidates.value.filter((item) => selectedIds.value.includes(item.id)))
const canCreate = computed(() => groupName.value.trim() && selectedIds.value.length >= 2 && !createResult.value)

const loadCandidates = async () => {
  loading.value = true
  try {
    const response = await ChatService.getGroupCandidates()
    candidates.value = response.data || []
    selectedIds.value = candidates.value.slice(0, 2).map((item) => item.id)
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
  const response = await ChatService.createGroup({
    name: groupName.value,
    notice: notice.value,
    memberIds: selectedIds.value,
  })
  createResult.value = response.data
}

const enterGroupChat = () => {
  if (!createResult.value?.chatId) return
  router.replace({
    path: `/chat/${createResult.value.chatId}`,
    query: { title: createResult.value.name || groupName.value || '新建群聊' },
  })
}

onMounted(loadCandidates)
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <div>
        <h2 class="text-lg font-bold">创建群聊</h2>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-4">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="space-y-3">
          <label class="block text-sm">
            <span class="mb-2 block text-[#8e9bb0]">群聊名称</span>
            <input v-model="groupName" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none" />
          </label>
          <label class="block text-sm">
            <span class="mb-2 block text-[#8e9bb0]">群公告</span>
            <textarea v-model="notice" rows="3" class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none"></textarea>
          </label>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold">选择成员</h3>
          <span class="text-xs text-[#c99b18]">已选 {{ selectedIds.length }} 人</span>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3">
          <button
            v-for="item in candidates"
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
              {{ selectedIds.includes(item.id) ? '已选' : '选择' }}
            </span>
          </button>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="text-base font-bold">已选成员</h3>
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
          创建群聊
        </button>
      </section>

      <section v-if="createResult" class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <div class="flex items-center gap-3 text-[#34d399]">
          <CheckCircle2 :size="20" />
          <div>
            <p class="font-bold">群聊创建成功</p>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ createResult.name }} · {{ createResult.memberCount }} 位成员已加入</p>
          </div>
        </div>
        <button @click="enterGroupChat" class="mt-4 w-full rounded-2xl bg-[#c99b18] px-4 py-3 text-sm font-bold text-white btn-interact">
          进入群聊
        </button>
      </section>
    </div>
  </div>
</template>
