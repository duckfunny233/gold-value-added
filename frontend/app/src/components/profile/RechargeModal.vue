<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, WalletCards } from 'lucide-vue-next'
import { UserService } from '../../services/user'
import { showToast } from '../../composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'success'])
const { t, locale } = useI18n()

const channels = [
  { labelKey: 'settings.payment.wechat', value: 'wechat' },
  { labelKey: 'settings.payment.alipay', value: 'alipay' },
  { labelKey: 'settings.payment.bankcard', value: 'bankcard' },
]

const selectedChannel = ref('wechat')
const amount = ref('')
const creating = ref(false)
const confirming = ref(false)
const order = ref(null)

const amountValue = computed(() => Number(amount.value))
const canCreate = computed(() => amountValue.value > 0 && !creating.value)

const reset = () => {
  selectedChannel.value = 'wechat'
  amount.value = ''
  creating.value = false
  confirming.value = false
  order.value = null
}

watch(() => props.visible, (value) => {
  if (!value) reset()
})

const createOrder = async () => {
  if (!canCreate.value) return
  creating.value = true
  try {
    const response = await UserService.createRechargeOrder(selectedChannel.value, amountValue.value)
    order.value = response.data
    showToast(t('settings.recharge.toast.orderCreated'))
  } catch (error) {
    showToast(error.message ? t(error.message) : t('settings.recharge.toast.createFailed'))
  } finally {
    creating.value = false
  }
}

const confirmPaid = async () => {
  if (!order.value?.orderId) return
  confirming.value = true
  try {
    const response = await UserService.confirmRecharge(order.value.orderId)
    emit('success', response.data)
    emit('close')
  } catch (error) {
    showToast(error.message ? t(error.message) : t('settings.recharge.toast.confirmFailed'))
  } finally {
    confirming.value = false
  }
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
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#223244] text-[#ff6a62]">
            <WalletCards :size="22" />
          </div>
          <div>
            <h3 class="text-lg font-bold">{{ t('settings.recharge.title') }}</h3>
            <p class="text-xs text-[#8e9bb0]">{{ t('settings.recharge.desc') }}</p>
          </div>
        </div>

        <div v-if="!order" class="space-y-4">
          <div>
            <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.recharge.channel') }}</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="channel in channels"
                :key="channel.value"
                @click="selectedChannel = channel.value"
                class="rounded-xl border px-3 py-2 text-sm font-bold btn-interact"
                :class="selectedChannel === channel.value ? 'border-[#c99b18] bg-[#243447] text-[#f2c24a]' : 'border-[#304255] bg-[#101b28] text-[#c9d5e2]'"
              >
                {{ t(channel.labelKey) }}
              </button>
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.recharge.amount') }}</p>
            <div class="flex items-center rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3">
              <span class="mr-3 text-lg font-bold text-[#f2c24a]">¥</span>
              <input
                v-model="amount"
                type="number"
                min="0"
                step="0.01"
                :placeholder="t('settings.recharge.amountPlaceholder')"
                class="w-full bg-transparent text-white outline-none placeholder:text-[#6f8093]"
              />
            </div>
          </div>

          <button
            @click="createOrder"
            class="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white btn-interact"
            :class="canCreate ? 'bg-[#ff5f56]' : 'bg-[#304255] text-[#72859a]'"
            :disabled="!canCreate"
          >
            {{ creating ? t('settings.recharge.creating') : t('settings.recharge.payNow') }}
          </button>
        </div>

        <div v-else class="space-y-4">
          <div class="rounded-2xl border border-[#304255] bg-[#101b28] p-4 text-sm">
            <p class="text-[#8e9bb0]">{{ t('settings.recharge.orderNo') }}{{ order.orderId }}</p>
            <p class="mt-2 text-[#dce6f0]">{{ t('settings.recharge.channel') }}{{ t(channels.find(item => item.value === order.channel)?.labelKey || 'common.noData') }}</p>
            <p class="mt-2 font-bold text-[#f2c24a]">{{ t('settings.recharge.amount') }}¥{{ Number(order.amount || 0).toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
            <p class="mt-2 text-[#8e9bb0]">{{ order.payHint || t('settings.recharge.payHint') }}</p>
          </div>

          <button
            @click="confirmPaid"
            class="w-full rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact"
            :disabled="confirming"
          >
            {{ confirming ? t('settings.recharge.confirming') : t('settings.recharge.paidDone') }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>
