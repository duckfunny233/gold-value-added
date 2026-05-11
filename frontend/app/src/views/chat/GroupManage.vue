<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { ChatService } from '../../services/chat'
import { showToast } from '../../composables/useToast'

const route = useRoute()
const router = useRouter()
const chatId = computed(() => Number(route.params.id))
const loading = ref(false)
const settings = ref(null)
const members = ref([])
const inviteIds = ref('')
const rename = ref('')
const notice = ref('')
const avatarUrl = ref('')
const mutedAll = ref(false)
const myMuted = ref(false)
const updatingMute = ref(false)
const transferTo = ref('')

const isOwner = computed(() => settings.value?.myRole === 'OWNER')
const isAdmin = computed(() => isOwner.value || settings.value?.myRole === 'ADMIN')
const memberAvatar = (member) =>
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(member?.uid || member?.username || 'user')}`
const ownerCandidates = computed(() => members.value.filter((m) => !m.isOwner))

const load = async () => {
  loading.value = true
  try {
    const [s, m] = await Promise.all([
      ChatService.getGroupSettings(chatId.value),
      ChatService.getGroupMembers(chatId.value),
    ])
    settings.value = s.data
    members.value = m.data || []
    rename.value = settings.value?.name || ''
    notice.value = settings.value?.notice || ''
    avatarUrl.value = settings.value?.avatarUrl || ''
    mutedAll.value = !!settings.value?.mutedAll
    myMuted.value = !!settings.value?.myNotificationMuted
  } finally {
    loading.value = false
  }
}

const updateMyNotificationMuted = async () => {
  if (updatingMute.value) return
  updatingMute.value = true
  try {
    await ChatService.updateMyGroupProfile(chatId.value, {
      notificationMuted: myMuted.value,
    })
    showToast(myMuted.value ? '已开启消息免打扰' : '已关闭消息免打扰')
  } finally {
    updatingMute.value = false
  }
}

const saveGroupSettings = async () => {
  await ChatService.updateGroupSettings(chatId.value, {
    name: rename.value.trim(),
    notice: notice.value.trim(),
    avatarUrl: avatarUrl.value.trim(),
    mutedAll: mutedAll.value,
  })
  showToast('群设置已更新')
  await load()
}

const onAvatarFileChange = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    avatarUrl.value = String(reader.result || '')
  }
  reader.readAsDataURL(file)
}

const invite = async () => {
  const ids = inviteIds.value.split(',').map((x) => x.trim()).filter(Boolean)
  if (!ids.length) return
  await ChatService.inviteGroupMembers(chatId.value, ids)
  showToast('邀请已发送')
  inviteIds.value = ''
  await load()
}

const clearHistory = async () => {
  await ChatService.clearGroupHistory(chatId.value)
  showToast('已清空当前会话记录')
}

const leaveGroup = async () => {
  await ChatService.leaveGroup(chatId.value)
  showToast('已退出群聊')
  router.replace('/chat')
}

const kick = async (userId) => {
  await ChatService.removeGroupMember(chatId.value, userId)
  showToast('已移出成员')
  await load()
}

const transferOwner = async () => {
  if (!transferTo.value.trim()) return
  await ChatService.transferGroupOwner(chatId.value, transferTo.value.trim())
  showToast('群主已转让')
  await load()
}

const dissolve = async () => {
  await ChatService.dissolveGroup(chatId.value)
  showToast('群聊已解散')
  router.replace('/chat')
}

onMounted(load)
</script>

<template>
  <div class="fixed inset-0 z-[110] bg-[#0b1520] text-white overflow-y-auto">
    <header class="flex items-center gap-3 border-b border-[#233242] bg-[#1a2735] px-4 py-3 sticky top-0">
      <button @click="router.back()" class="text-[#cfd8e3]"><ArrowLeft :size="22" /></button>
      <h2 class="text-lg font-bold">群管理</h2>
    </header>

    <div class="p-4 space-y-4" v-if="!loading">
      <section class="rounded-2xl border border-[#2b3b4c] bg-[#162331] p-4 space-y-3">
        <label class="flex items-center gap-2 text-sm text-[#cfd8e3]">
          <input type="checkbox" v-model="myMuted" :disabled="updatingMute" @change="updateMyNotificationMuted" />
          消息免打扰
        </label>
        <div class="flex gap-2">
          <button @click="clearHistory" class="rounded-xl border border-[#304255] px-4 py-2 text-sm">清空聊天记录</button>
          <button @click="leaveGroup" class="rounded-xl border border-[#7f1d1d] bg-[#3f1d1d] px-4 py-2 text-sm">退出群聊</button>
        </div>
      </section>

      <section class="rounded-2xl border border-[#2b3b4c] bg-[#162331] p-4 space-y-3">
        <h3 class="font-bold">群成员</h3>
        <div class="text-xs text-[#8e9bb0]">成员 {{ members.length }} 人</div>
        <div class="space-y-2">
          <div v-for="m in members" :key="m.userId" class="rounded-xl bg-[#101b28] px-3 py-2 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img :src="memberAvatar(m)" :alt="m.groupNickname || m.username" class="h-8 w-8 rounded-full border border-[#304255] bg-[#162331]" />
              <div class="text-sm">{{ m.groupNickname || m.username }}</div>
            </div>
            <button v-if="isAdmin && !m.isOwner" @click="kick(m.userId)" class="text-xs text-[#fda4af]">踢人</button>
          </div>
        </div>
        <div class="flex gap-2">
          <input v-model="inviteIds" placeholder="邀请好友ID，逗号分隔" class="flex-1 rounded-xl bg-[#101b28] px-3 py-2 outline-none border border-[#304255]" />
          <button @click="invite" class="rounded-xl bg-[#c99b18] px-4 py-2 text-sm font-bold">邀请进群</button>
        </div>
      </section>

      <section v-if="isAdmin" class="rounded-2xl border border-[#2b3b4c] bg-[#162331] p-4 space-y-3">
        <h3 class="font-bold">群主/管理员功能</h3>
        <input v-model="rename" placeholder="群名称" class="w-full rounded-xl bg-[#101b28] px-3 py-2 outline-none border border-[#304255]" />
        <div class="rounded-xl border border-[#304255] bg-[#101b28] p-3">
          <div class="flex items-center gap-3">
            <img v-if="avatarUrl" :src="avatarUrl" alt="群头像预览" class="h-12 w-12 rounded-full border border-[#304255] object-cover" />
            <div class="flex-1 text-xs text-[#8e9bb0]">群头像</div>
            <label class="rounded-lg border border-[#304255] px-3 py-1.5 text-xs text-[#cfd8e3]">
              上传图片
              <input type="file" accept="image/*" class="hidden" @change="onAvatarFileChange" />
            </label>
          </div>
        </div>
        <textarea v-model="notice" rows="3" placeholder="群公告" class="w-full rounded-xl bg-[#101b28] px-3 py-2 outline-none border border-[#304255]"></textarea>
        <label class="flex items-center gap-2 text-sm text-[#cfd8e3]">
          <input type="checkbox" v-model="mutedAll" />
          全员禁言
        </label>
        <button @click="saveGroupSettings" class="rounded-xl bg-[#19c58a] px-4 py-2 text-sm font-bold">保存群设置</button>

        <div v-if="isOwner" class="space-y-2">
          <select v-model="transferTo" class="w-full rounded-xl bg-[#101b28] px-3 py-2 outline-none border border-[#304255]">
            <option value="">选择要转让的群成员</option>
            <option v-for="member in ownerCandidates" :key="member.userId" :value="member.userId">
              {{ member.groupNickname || member.username }}
            </option>
          </select>
          <div class="flex gap-2">
            <button @click="transferOwner" class="rounded-xl border border-[#304255] px-4 py-2 text-sm">转让群主</button>
            <button @click="dissolve" class="rounded-xl border border-[#7f1d1d] bg-[#3f1d1d] px-4 py-2 text-sm">解散群聊</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
