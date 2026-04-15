<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Smartphone, Fingerprint, KeyRound, History } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'SecuritySettings' })

const router = useRouter()
const { t } = useI18n()
const data = ref(null)
const loading = ref(false)
const keyForm = reactive({
  currentKey: '',
  newKey: '',
  confirmKey: '',
})

const fetchData = async () => {
  loading.value = true
  try {
    const response = await SettingsService.getSecuritySettings()
    data.value = response.data
  } finally {
    loading.value = false
  }
}

const toggleField = async (field) => {
  if (!data.value) return
  const patch = { [field]: !data.value[field] }
  const response = await SettingsService.updateSecuritySettings(patch)
  data.value = response.data
  showToast(t('settings.security.toast.updated'))
}

const removeDevice = async (deviceId) => {
  await SettingsService.removeDevice(deviceId)
  await fetchData()
  showToast(t('settings.security.toast.deviceRemoved'))
}

const submitChangeSecretKey = async () => {
  if (!keyForm.currentKey || !keyForm.newKey || !keyForm.confirmKey) {
    showToast(t('settings.security.toast.fillAll'))
    return
  }
  if (keyForm.newKey.length < 6) {
    showToast(t('settings.security.toast.keyTooShort'))
    return
  }
  if (keyForm.newKey !== keyForm.confirmKey) {
    showToast(t('settings.security.toast.keyMismatch'))
    return
  }

  try {
    await SettingsService.changeSecretKey(keyForm.currentKey, keyForm.newKey)
    keyForm.currentKey = ''
    keyForm.newKey = ''
    keyForm.confirmKey = ''
    showToast(t('settings.security.toast.keyChanged'))
  } catch (error) {
    showToast(error.message ? t(error.message) : t('settings.security.toast.keyChangeFailed'))
  }
}

const translateLogResult = (result) => {
  if (String(result || '').toLowerCase() === 'success') {
    return t('settings.security.log.success')
  }
  return t('settings.security.log.failed')
}

const isLogSuccess = (result) => String(result || '').toLowerCase() === 'success'

onMounted(fetchData)
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">{{ t('settings.security.title') }}</h2>
    </header>

    <div class="flex-1 overflow-y-auto py-4 space-y-0" v-if="data">
      <section class="border-y border-[#2b3b4c] bg-[#162331] px-4 py-4">
        <h3 class="text-sm font-bold mb-3">{{ t('settings.security.sectionRealName') }}</h3>
        <div class="space-y-0 text-sm border border-[#2b3b4c] bg-[#101b28]">
          <div class="flex items-center justify-between border-b border-[#2b3b4c] px-4 py-3">
            <div class="flex items-center gap-2"><KeyRound :size="16" class="text-[#c99b18]" />{{ t('settings.security.realNameStatus') }}</div>
            <span class="text-[#19c58a] font-bold">{{ t(data.realNameStatus) }}</span>
          </div>
          <button @click="toggleField('passwordSet')" class="flex w-full items-center justify-between border-b border-[#2b3b4c] px-4 py-3 btn-interact">
            <span class="flex items-center gap-2"><KeyRound :size="16" class="text-[#c99b18]" />{{ t('settings.security.keyProtection') }}</span>
            <span :class="data.passwordSet ? 'text-[#19c58a]' : 'text-[#8e9bb0]'">{{ data.passwordSet ? t('settings.security.enabled') : t('settings.security.disabled') }}</span>
          </button>
          <button @click="toggleField('biometricEnabled')" class="flex w-full items-center justify-between px-4 py-3 btn-interact">
            <span class="flex items-center gap-2"><Fingerprint :size="16" class="text-[#c99b18]" />{{ t('settings.security.biometric') }}</span>
            <span :class="data.biometricEnabled ? 'text-[#19c58a]' : 'text-[#8e9bb0]'">{{ data.biometricEnabled ? t('settings.security.enabled') : t('settings.security.disabled') }}</span>
          </button>
        </div>
      </section>

      <section class="border-b border-[#2b3b4c] bg-[#162331] px-4 py-4">
        <h3 class="text-sm font-bold mb-3">{{ t('settings.security.sectionDevices') }}</h3>
        <div class="space-y-0 border border-[#2b3b4c] bg-[#101b28]">
          <div v-for="item in data.devices" :key="item.id" class="border-b border-[#2b3b4c] px-4 py-3 last:border-b-0">
            <div class="flex items-center justify-between">
              <p class="font-bold text-sm flex items-center gap-2"><Smartphone :size="14" class="text-[#7f90a4]" />{{ item.name }}</p>
              <button @click="removeDevice(item.id)" class="text-xs text-[#ff7d75] btn-interact">{{ t('settings.security.remove') }}</button>
            </div>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ item.location }} · {{ item.lastActive }}</p>
          </div>
        </div>
      </section>

      <section class="border-b border-[#2b3b4c] bg-[#162331] px-4 py-4">
        <h3 class="text-sm font-bold mb-3">{{ t('settings.security.sectionChangeKey') }}</h3>
        <div class="space-y-3 border border-[#2b3b4c] bg-[#101b28] p-4">
          <label class="block text-xs text-[#8e9bb0]">
            {{ t('settings.security.currentKey') }}
            <input
              v-model="keyForm.currentKey"
              type="password"
              :placeholder="t('settings.security.currentKeyPlaceholder')"
              class="mt-1 w-full border border-[#2b3b4c] bg-[#0d1926] px-3 py-2 text-sm text-[#dbe6f2] outline-none focus:border-[#c99b18]"
            />
          </label>
          <label class="block text-xs text-[#8e9bb0]">
            {{ t('settings.security.newKey') }}
            <input
              v-model="keyForm.newKey"
              type="password"
              :placeholder="t('settings.security.newKeyPlaceholder')"
              class="mt-1 w-full border border-[#2b3b4c] bg-[#0d1926] px-3 py-2 text-sm text-[#dbe6f2] outline-none focus:border-[#c99b18]"
            />
          </label>
          <label class="block text-xs text-[#8e9bb0]">
            {{ t('settings.security.confirmKey') }}
            <input
              v-model="keyForm.confirmKey"
              type="password"
              :placeholder="t('settings.security.confirmKeyPlaceholder')"
              class="mt-1 w-full border border-[#2b3b4c] bg-[#0d1926] px-3 py-2 text-sm text-[#dbe6f2] outline-none focus:border-[#c99b18]"
            />
          </label>
          <p class="text-[11px] text-[#7f90a4]">
            {{ t('settings.security.keyRule') }}
          </p>
          <button
            @click="submitChangeSecretKey"
            class="w-full border border-[#3a5169] bg-[#1c2d3e] px-3 py-2 text-sm font-bold text-[#ecf2f9] btn-interact hover:bg-[#22374d]"
          >
            {{ t('settings.security.confirmChangeKey') }}
          </button>
        </div>
      </section>

      <section class="border-b border-[#2b3b4c] bg-[#162331] px-4 py-4">
        <h3 class="text-sm font-bold mb-3 flex items-center gap-2"><History :size="14" class="text-[#7f90a4]" />{{ t('settings.security.sectionLoginLogs') }}</h3>
        <div class="space-y-0 border border-[#2b3b4c] bg-[#101b28]">
          <div v-for="log in data.loginLogs" :key="log.id" class="border-b border-[#2b3b4c] px-4 py-3 text-xs last:border-b-0">
            <div class="flex justify-between"><span>{{ log.time }}</span><span :class="isLogSuccess(log.result) ? 'text-[#19c58a]' : 'text-[#ff7d75]'">{{ translateLogResult(log.result) }}</span></div>
            <p class="mt-1 text-[#8e9bb0]">{{ t('settings.security.ipLabel') }}{{ log.ip }}</p>
          </div>
        </div>
        <p class="mt-3 text-[11px] text-[#7f90a4]">
          {{ t('settings.security.manualResetNote') }}
        </p>
      </section>
    </div>

    <div v-else class="flex-1 flex items-center justify-center text-[#8e9bb0]">{{ loading ? t('common.loading') : t('common.noData') }}</div>
  </div>
</template>
