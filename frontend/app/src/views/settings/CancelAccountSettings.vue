<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, ArrowLeft, MessageSquareWarning, ShieldCheck, X } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { AuthService } from '../../services/auth'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'CancelAccountSettings' })

const router = useRouter()
const { t } = useI18n()
const loading = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const otpToken = ref('')
const otpMaskedMobile = ref('138****1024')
const secretKey = ref('')
const smsCode = ref('')
const openConfirm = ref(false)
const acknowledgedRisk = ref(false)

let timer = null

const canSubmit = computed(() => {
  return secretKey.value.trim().length > 0 && smsCode.value.trim().length > 0 && acknowledgedRisk.value
})

const closeConfirm = () => {
  openConfirm.value = false
  acknowledgedRisk.value = false
}

const sendCode = async () => {
  if (sendingCode.value || countdown.value > 0) return
  sendingCode.value = true
  try {
    const response = await SettingsService.sendCancelAccountOtp()
    otpToken.value = response.data.otpToken
    otpMaskedMobile.value = response.data.maskedMobile
    countdown.value = Number(response.data.expireSeconds || 60)
    showToast(t('settings.cancel.toast.codeSent'))

    timer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) {
        clearInterval(timer)
        timer = null
      }
    }, 1000)
  } catch (error) {
    showToast(error.message ? t(error.message) : t('settings.cancel.toast.codeFailed'))
  } finally {
    sendingCode.value = false
  }
}

const openCancelConfirm = () => {
  if (!secretKey.value.trim()) {
    showToast(t('settings.cancel.toast.enterKey'))
    return
  }
  if (!smsCode.value.trim()) {
    showToast(t('settings.cancel.toast.enterSms'))
    return
  }
  openConfirm.value = true
}

const confirmCancel = async () => {
  if (!canSubmit.value) {
    showToast(t('settings.cancel.toast.completeVerify'))
    return
  }
  loading.value = true
  try {
    await SettingsService.cancelAccount({
      secretKey: secretKey.value,
      smsCode: smsCode.value,
      otpToken: otpToken.value,
    })

    AuthService.clearSensitiveLocalData()
    showToast(t('settings.cancel.toast.canceled'))
    closeConfirm()
    router.replace('/login')
  } catch (error) {
    showToast(error.message ? t(error.message) : t('settings.cancel.toast.failed'))
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">{{ t('settings.cancel.title') }}</h2>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <section class="rounded-3xl border border-[#5a2f2f] bg-[#20171a] p-4">
        <div class="flex items-start gap-3">
          <AlertTriangle class="mt-0.5 text-[#ff7d75]" :size="18" />
          <div>
            <h3 class="text-sm font-bold text-[#ffd2cf]">{{ t('settings.cancel.riskTitle') }}</h3>
            <p class="mt-2 text-xs leading-6 text-[#f0b1ad]">
              {{ t('settings.cancel.riskDesc') }}
            </p>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-[#2b3b4c] bg-[#162331] p-4">
        <h3 class="mb-3 text-sm font-bold">{{ t('settings.cancel.verifyTitle') }}</h3>
        <div class="space-y-3">
          <label class="block text-xs text-[#8e9bb0]">
            {{ t('settings.cancel.verifyKey') }}
            <input
              v-model="secretKey"
              type="password"
              :placeholder="t('settings.cancel.verifyKeyPlaceholder')"
              class="mt-2 w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none"
            />
          </label>

          <label class="block text-xs text-[#8e9bb0]">
            {{ t('settings.cancel.smsLabel', { mobile: otpMaskedMobile }) }}
            <div class="mt-2 flex gap-2">
              <input
                v-model="smsCode"
                type="text"
                maxlength="6"
                :placeholder="t('settings.cancel.smsPlaceholder')"
                class="flex-1 rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none"
              />
              <button
                @click="sendCode"
                :disabled="sendingCode || countdown > 0"
                class="rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-xs font-bold text-[#dbe6f2] btn-interact disabled:opacity-50"
              >
                {{ countdown > 0 ? `${countdown}s` : t('settings.cancel.sendCode') }}
              </button>
            </div>
          </label>
        </div>
      </section>

      <button
        @click="openCancelConfirm"
        class="w-full rounded-2xl bg-[#ff5f56] px-4 py-3 text-sm font-bold text-white btn-interact flex items-center justify-center gap-2"
      >
        <MessageSquareWarning :size="16" />
        {{ t('settings.cancel.apply') }}
      </button>
    </div>

    <teleport to="body">
      <div v-if="openConfirm" class="fixed inset-0 z-[130] flex items-end justify-center">
        <div class="absolute inset-0 bg-black/60" @click="closeConfirm"></div>
        <div class="relative w-full rounded-t-[28px] border border-[#304255] bg-[#162331] p-5 text-white shadow-2xl">
          <button @click="closeConfirm" class="absolute right-4 top-4 text-[#8e9bb0] btn-interact">
            <X :size="20" />
          </button>

          <h3 class="text-lg font-bold">{{ t('settings.cancel.confirmTitle') }}</h3>
          <p class="mt-2 text-xs leading-6 text-[#c6d1de]">
            {{ t('settings.cancel.confirmDesc') }}
          </p>

          <label class="mt-4 flex items-center gap-2 text-xs text-[#dbe6f2]">
            <input v-model="acknowledgedRisk" type="checkbox" class="h-4 w-4 accent-[#ff5f56]" />
            {{ t('settings.cancel.confirmRisk') }}
          </label>

          <div class="mt-5 flex gap-3">
            <button @click="closeConfirm" class="flex-1 rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm font-bold text-[#dbe6f2] btn-interact">
              {{ t('common.cancel') }}
            </button>
            <button
              @click="confirmCancel"
              :disabled="!canSubmit || loading"
              class="flex-1 rounded-2xl bg-[#ff5f56] px-4 py-3 text-sm font-bold text-white btn-interact disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldCheck :size="16" />
              {{ loading ? t('settings.cancel.canceling') : t('settings.cancel.confirmAction') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
