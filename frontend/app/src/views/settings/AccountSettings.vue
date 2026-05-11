<script setup>
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Plus, Save, Upload, X, PenLine } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'AccountSettings' })

const router = useRouter()
const { t } = useI18n()
const form = ref({
  nickname: '',
  avatar: '',
  mobile: '',
  bindStatus: '',
})
const showAvatarModal = ref(false)
const pendingAvatar = ref('')
const fileInputRef = ref(null)
const showNicknameSheet = ref(false)
const pendingNickname = ref('')
const nicknameInputRef = ref(null)

const avatarInitial = computed(() => {
  const nickname = String(form.value.nickname || '').trim()
  return nickname ? nickname.charAt(0) : 'U'
})

onMounted(async () => {
  const response = await SettingsService.getAccountSettings()
  form.value = response.data
})

const openNicknameSheet = () => {
  pendingNickname.value = form.value.nickname || ''
  showNicknameSheet.value = true
}

const closeNicknameSheet = () => {
  showNicknameSheet.value = false
}

const saveNickname = async () => {
  if (pendingNickname.value.trim() === '') {
    showToast(t('settings.account.toast.nicknameEmpty'))
    return
  }
  try {
    const response = await SettingsService.updateAccountSettings({
      nickname: pendingNickname.value,
      avatar: form.value.avatar,
    })
    form.value = response.data

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
    if (storedUser) {
      storedUser.nickname = response.data.nickname
      storedUser.avatar = response.data.avatar
      localStorage.setItem('user', JSON.stringify(storedUser))
    }

    showNicknameSheet.value = false
    showToast(t('settings.account.toast.nicknameSaved'))
  } catch (error) {
    showToast(error.message || 'Failed to save nickname')
  }
}

watch(showNicknameSheet, (val) => {
  if (val) {
    nextTick(() => {
      nicknameInputRef.value?.focus()
    })
  }
})

const saveAccount = async () => {
  const response = await SettingsService.updateAccountSettings({
    nickname: form.value.nickname,
    avatar: form.value.avatar,
  })
  form.value = response.data

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
  if (storedUser) {
    storedUser.nickname = response.data.nickname
    storedUser.avatar = response.data.avatar
    localStorage.setItem('user', JSON.stringify(storedUser))
  }

  showToast(t('settings.account.toast.saved'))
}

const openAvatarModal = () => {
  pendingAvatar.value = form.value.avatar || ''
  showAvatarModal.value = true
}

const closeAvatarModal = () => {
  showAvatarModal.value = false
}

const pickAvatarFile = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

const onAvatarFileChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    showToast(t('settings.account.toast.uploadImageOnly'))
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast(t('settings.account.toast.uploadTooLarge'))
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    pendingAvatar.value = String(reader.result || '')
  }
  reader.readAsDataURL(file)
}

const confirmAvatarChange = () => {
  if (!pendingAvatar.value) {
    showToast(t('settings.account.toast.selectImageFirst'))
    return
  }
  form.value.avatar = pendingAvatar.value
  showAvatarModal.value = false
  showToast(t('settings.account.toast.avatarReplaced'))
}
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">{{ t('settings.account.title') }}</h2>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.account.sectionProfile') }}</h3>
        <div class="space-y-3">
          <div class="block">
            <label class="text-xs text-[#8e9bb0]">{{ t('settings.account.nickname') }}</label>
            <button @click="openNicknameSheet" class="mt-2 w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-left text-white flex items-center justify-between btn-interact">
              <span :class="form.nickname ? 'text-white' : 'text-[#8e9bb0]'">{{ form.nickname || t('settings.account.noNickname') }}</span>
              <PenLine :size="16" class="text-[#c99b18]" />
            </button>
          </div>
          <div class="text-xs text-[#8e9bb0]">
            {{ t('settings.account.currentAvatar') }}
            <div class="mt-2 flex items-center gap-4 rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-4">
              <div class="relative">
                <div class="h-16 w-16 overflow-hidden rounded-full border border-[#3a4e64] bg-[#223244]">
                  <img v-if="form.avatar" :src="form.avatar" class="h-full w-full object-cover" />
                  <div v-else class="flex h-full w-full items-center justify-center text-lg font-bold text-[#c99b18]">{{ avatarInitial }}</div>
                </div>
                <button @click="openAvatarModal" class="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#c99b18] text-[#13202c] btn-interact">
                  <Plus :size="16" />
                </button>
              </div>
              <div>
                <p class="text-sm font-bold text-[#dce6f0]">{{ t('settings.account.avatarTip') }}</p>
                <p class="mt-1 text-xs text-[#8e9bb0]">{{ t('settings.account.avatarRule') }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.account.sectionPhone') }}</h3>
        <div class="rounded-2xl bg-[#101b28] px-4 py-3 text-sm text-[#dce6f0]">
          {{ t('settings.account.currentMobile') }}{{ form.mobile }}
        </div>
        <p class="mt-2 text-xs text-[#8e9bb0]">{{ t('settings.account.phoneFlow') }}</p>
      </section>

      <button @click="saveAccount" class="w-full rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact flex items-center justify-center gap-2">
        <Save :size="16" />{{ t('settings.account.save') }}
      </button>
    </div>

    <teleport to="body">
      <div v-if="showNicknameSheet" class="fixed inset-0 z-[130] flex items-end justify-center">
        <div class="absolute inset-0 bg-black/60" @click="closeNicknameSheet"></div>
        <div class="relative w-full rounded-t-[28px] bg-[#162331] text-white">
          <div class="flex items-center justify-between border-b border-[#304255] px-4 py-4">
            <button @click="closeNicknameSheet" class="btn-interact text-[#8e9bb0] text-sm">{{ t('common.cancel') }}</button>
            <span class="text-base font-bold">{{ t('settings.account.editNickname') }}</span>
            <button @click="saveNickname" class="btn-interact text-[#19c58a] text-sm font-bold">{{ t('common.confirm') }}</button>
          </div>
          <div class="p-4">
            <input
              ref="nicknameInputRef"
              v-model="pendingNickname"
              :placeholder="t('settings.account.nicknamePlaceholder')"
              class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none focus:border-[#c99b18]"
              maxlength="20"
            />
            <p class="mt-2 text-xs text-[#8e9bb0] text-right">{{ pendingNickname.length }}/20</p>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div v-if="showAvatarModal" class="fixed inset-0 z-[130] flex items-end justify-center">
        <div class="absolute inset-0 bg-black/60" @click="closeAvatarModal"></div>
        <div class="relative w-full rounded-t-[28px] border border-[#304255] bg-[#162331] p-5 text-white shadow-2xl">
          <button @click="closeAvatarModal" class="absolute right-4 top-4 text-[#8e9bb0] btn-interact">
            <X :size="20" />
          </button>

          <h3 class="text-lg font-bold">{{ t('settings.account.uploadTitle') }}</h3>
          <p class="mt-1 text-xs text-[#8e9bb0]">{{ t('settings.account.uploadDesc') }}</p>

          <div class="mt-5 flex justify-center">
            <div class="h-24 w-24 overflow-hidden rounded-full border border-[#3a4e64] bg-[#223244]">
              <img v-if="pendingAvatar" :src="pendingAvatar" class="h-full w-full object-cover" />
              <div v-else class="flex h-full w-full items-center justify-center text-2xl font-bold text-[#c99b18]">{{ avatarInitial }}</div>
            </div>
          </div>

          <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="onAvatarFileChange" />

          <button @click="pickAvatarFile" class="mt-5 w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm font-bold text-[#dce6f0] btn-interact flex items-center justify-center gap-2">
            <Upload :size="16" />{{ t('settings.account.selectImage') }}
          </button>

          <button @click="confirmAvatarChange" class="mt-3 w-full rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact">
            {{ t('settings.account.confirmReplace') }}
          </button>
        </div>
      </div>
    </teleport>
  </div>
</template>