<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, BadgeDollarSign, AlertCircle } from 'lucide-vue-next'
import { UserService } from '../../services/user'
import { showToast } from '../../composables/useToast'
import PaymentMethodModal from './PaymentMethodModal.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  availableBalance: {
    type: Number,
    default: 0,
  },
  hasRecharged: {
    type: Boolean,
    default: false,
  },
  paymentMethod: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'success', 'bindPaymentMethod'])

const { t, locale } = useI18n()

const channels = [
  { labelKey: 'settings.payment.wechat', value: 'wechat' },
  { labelKey: 'settings.payment.alipay', value: 'alipay' },
  { labelKey: 'settings.payment.bankcard', value: 'bankcard' },
]

const selectedChannel = ref('wechat')
const amount = ref('')
const mobile = ref('')
const smsCode = ref('')
const smsToken = ref('')
const sendingSms = ref(false)
const submiting = ref(false)
const smsCountdown = ref(0)
const showPaymentMethodModal = ref(false)
let smsTimer = null

const amountValue = computed(() => Number(amount.value))
const mobileValid = computed(() => /^1\d{10}$/.test(mobile.value.trim()))
const canSendSms = computed(() => amountValue.value > 0 && mobileValid.value && smsCountdown.value === 0 && !sendingSms.value)

// 检查是否可以提现
const canWithdraw = computed(() => {
  // 未充值用户不能提现
  if (!props.hasRecharged) return false
  // 未绑定收款方式不能提现
  if (!props.paymentMethod) return false
  return true
})

const canSubmit = computed(() => {
  return canWithdraw.value &&
    amountValue.value > 0
    && amountValue.value <= props.availableBalance
    && mobileValid.value
    && smsCode.value.trim().length >= 4
    && smsToken.value
    && !submiting.value
})

const clearTimer = () => {
  if (smsTimer) {
    clearInterval(smsTimer)
    smsTimer = null
  }
}

const reset = () => {
  selectedChannel.value = 'wechat'
  amount.value = ''
  mobile.value = ''
  smsCode.value = ''
  smsToken.value = ''
  sendingSms.value = false
  submiting.value = false
  smsCountdown.value = 0
  clearTimer()
}

watch(() => props.visible, (value) => {
  if (!value) reset()
})

// 监听已绑定的收款方式，同步选择对应的渠道
watch(() => props.paymentMethod, (method) => {
  if (method?.type) {
    selectedChannel.value = method.type
  }
}, { immediate: true })

const sendSms = async () => {
  if (!canSendSms.value) return
  sendingSms.value = true
  try {
    const response = await UserService.sendWithdrawSms(selectedChannel.value, amountValue.value, mobile.value.trim())
    smsToken.value = response.data.smsToken
    smsCountdown.value = Number(response.data.expireSeconds || 60)
    clearTimer()
    smsTimer = setInterval(() => {
      smsCountdown.value -= 1
      if (smsCountdown.value <= 0) {
        clearTimer()
      }
    }, 1000)
    showToast(t('settings.withdraw.toast.codeSent'))
  } catch (error) {
    showToast(error.message ? t(error.message) : t('settings.withdraw.toast.codeFailed'))
  } finally {
    sendingSms.value = false
  }
}

const submitWithdraw = async () => {
  if (!canSubmit.value) return
  submiting.value = true
  try {
    const response = await UserService.submitWithdraw(
      selectedChannel.value,
      amountValue.value,
      smsCode.value.trim(),
      smsToken.value,
      mobile.value.trim()
    )
    emit('success', response.data)
    emit('close')
  } catch (error) {
    showToast(error.message ? t(error.message) : t('settings.withdraw.toast.submitFailed'))
  } finally {
    submiting.value = false
  }
}

const handleBindPaymentMethod = () => {
  showPaymentMethodModal.value = true
}

const handlePaymentMethodSuccess = (method) => {
  emit('bindPaymentMethod', method)
}

const numberLocale = computed(() => {
  const localeMap = {
    zh: 'zh-CN',
    en: 'en-US',
    es: 'es-ES',
    ar: 'ar-SA',
    hi: 'hi-IN',
    ru: 'ru-RU',
    ja: 'ja-JP',
    pt: 'pt-BR',
    bn: 'bn-BD',
  }
  return localeMap[String(locale.value || '').toLowerCase()] || 'en-US'
})
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[130] flex items-end justify-center">
      <div class="absolute inset-0 bg-black/60" @click="emit('close')"></div>
      <div class="relative w-full rounded-t-[28px] border border-[#304255] bg-[#162331] p-5 text-white shadow-2xl">
        <button @click="emit('close')" class="absolute right-4 top-4 text-[#8e9bb0] btn-interact">
          <X :size="20" />
        </button>

        <div class="mb-5 flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#223244] text-[#19c58a]">
            <BadgeDollarSign :size="22" />
          </div>
          <div>
            <h3 class="text-lg font-bold">{{ t('settings.withdraw.title') }}</h3>
            <p class="text-xs text-[#8e9bb0]">{{ t('settings.withdraw.desc') }}</p>
          </div>
        </div>

        <!-- 未充值提示 -->
        <div v-if="!hasRecharged" class="mb-4 p-4 rounded-2xl bg-[#ff7d75]/10 border border-[#ff7d75]/30">
          <div class="flex items-start gap-3">
            <AlertCircle class="text-[#ff7d75] flex-shrink-0 mt-0.5" :size="20" />
            <div>
              <p class="font-bold text-[#ff7d75] mb-1">{{ t('settings.withdraw.noRechargeTitle') }}</p>
              <p class="text-sm text-[#8e9bb0]">{{ t('settings.withdraw.noRechargeDesc') }}</p>
            </div>
          </div>
        </div>

        <!-- 未绑定收款方式提示 -->
        <div v-else-if="!paymentMethod" class="mb-4 p-4 rounded-2xl bg-[#f2c24a]/10 border border-[#f2c24a]/30">
          <div class="flex items-start gap-3">
            <AlertCircle class="text-[#f2c24a] flex-shrink-0 mt-0.5" :size="20" />
            <div class="flex-1">
              <p class="font-bold text-[#f2c24a] mb-1">{{ t('settings.withdraw.noPaymentMethodTitle') }}</p>
              <p class="text-sm text-[#8e9bb0] mb-3">{{ t('settings.withdraw.noPaymentMethodDesc') }}</p>
              <button
                @click="handleBindPaymentMethod"
                class="px-4 py-2 rounded-xl bg-[#f2c24a] text-[#162331] text-sm font-bold btn-interact"
              >
                {{ t('settings.withdraw.bindPaymentMethod') }}
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-4" :class="{ 'opacity-50 pointer-events-none': !canWithdraw }">
          <div class="rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm text-[#8e9bb0]">
            {{ t('settings.withdraw.available') }}<span class="font-bold text-[#f2c24a]">¥{{ availableBalance.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>

          <!-- 已绑定的收款方式展示 -->
          <div v-if="paymentMethod" class="rounded-2xl border border-[#19c58a]/30 bg-[#19c58a]/10 px-4 py-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-[#19c58a] font-bold">{{ t('settings.withdraw.boundMethod') }}：</span>
                <span class="text-white">{{ t(`settings.payment.${paymentMethod.type}`) }}</span>
                <span class="text-[#8e9bb0] text-sm">({{ paymentMethod.name }})</span>
              </div>
              <button
                @click="handleBindPaymentMethod"
                class="text-xs text-[#f2c24a] btn-interact"
              >
                {{ t('settings.withdraw.changeMethod') }}
              </button>
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.withdraw.channel') }}</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="channel in channels"
                :key="channel.value"
                @click="selectedChannel = channel.value"
                class="rounded-xl border px-3 py-2 text-sm font-bold btn-interact"
                :class="selectedChannel === channel.value ? 'border-[#c99b18] bg-[#243447] text-[#f2c24a]' : 'border-[#304255] bg-[#101b28] text-[#c9d5e2]'"
                :disabled="!canWithdraw"
              >
                {{ t(channel.labelKey) }}
              </button>
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.withdraw.amount') }}</p>
            <div class="flex items-center rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3">
              <span class="mr-3 text-lg font-bold text-[#f2c24a]">¥</span>
              <input
                v-model="amount"
                type="number"
                min="0"
                step="0.01"
                :placeholder="t('settings.withdraw.amountPlaceholder')"
                class="w-full bg-transparent text-white outline-none placeholder:text-[#6f8093]"
                :disabled="!canWithdraw"
              />
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.withdraw.smsCode') }}</p>
            <div class="mb-2">
              <input
                v-model="mobile"
                type="tel"
                maxlength="11"
                :placeholder="t('settings.withdraw.mobilePlaceholder')"
                class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
                :disabled="!canWithdraw"
              />
              <p v-if="mobile && !mobileValid" class="mt-1 text-[11px] text-[#ff7d75]">{{ t('settings.withdraw.mobileInvalid') }}</p>
            </div>
            <div class="flex gap-2">
              <input
                v-model="smsCode"
                type="text"
                :placeholder="t('settings.withdraw.smsPlaceholder')"
                class="flex-1 rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
                :disabled="!canWithdraw"
              />
              <button
                @click="sendSms"
                class="rounded-2xl border border-[#304255] px-4 py-3 text-xs font-bold btn-interact"
                :class="canSendSms ? 'text-[#f2c24a] bg-[#223244]' : 'text-[#72859a] bg-[#1a2735]'"
                :disabled="!canSendSms"
              >
                {{ sendingSms ? t('settings.withdraw.sending') : (smsCountdown > 0 ? `${smsCountdown}s` : t('settings.withdraw.getCode')) }}
              </button>
            </div>
          </div>

          <button
            @click="submitWithdraw"
            class="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white btn-interact"
            :class="canSubmit ? 'bg-[#19c58a]' : 'bg-[#304255] text-[#72859a]'"
            :disabled="!canSubmit"
          >
            {{ submiting ? t('settings.withdraw.submitting') : t('settings.withdraw.confirm') }}
          </button>

          <p class="text-[11px] text-[#8e9bb0]">{{ t('settings.withdraw.hint') }}</p>
        </div>
      </div>
    </div>
  </teleport>

  <PaymentMethodModal
    :visible="showPaymentMethodModal"
    :existing-method="paymentMethod"
    @close="showPaymentMethodModal = false"
    @success="handlePaymentMethodSuccess"
  />
</template>
