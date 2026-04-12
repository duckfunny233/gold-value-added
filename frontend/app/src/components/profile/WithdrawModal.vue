<script setup>
import { computed, ref, watch } from 'vue'
import { X, BadgeDollarSign } from 'lucide-vue-next'
import { UserService } from '../../services/user'
import { showToast } from '../../composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  availableBalance: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['close', 'success'])

const channels = [
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '银行卡', value: 'bankcard' },
]

const selectedChannel = ref('wechat')
const amount = ref('')
const mobile = ref('')
const smsCode = ref('')
const smsToken = ref('')
const sendingSms = ref(false)
const submiting = ref(false)
const smsCountdown = ref(0)
let smsTimer = null

const amountValue = computed(() => Number(amount.value))
const mobileValid = computed(() => /^1\d{10}$/.test(mobile.value.trim()))
const canSendSms = computed(() => amountValue.value > 0 && mobileValid.value && smsCountdown.value === 0 && !sendingSms.value)
const canSubmit = computed(() => {
  return amountValue.value > 0
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
    showToast('验证码已发送，测试码 123456')
  } catch (error) {
    showToast(error.message || '验证码发送失败')
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
    showToast(error.message || '提现失败')
  } finally {
    submiting.value = false
  }
}
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
            <h3 class="text-lg font-bold">账户提现</h3>
            <p class="text-xs text-[#8e9bb0]">选择到账渠道、输入金额并完成短信验证</p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-sm text-[#8e9bb0]">
            可提现余额：<span class="font-bold text-[#f2c24a]">¥{{ availableBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>

          <div>
            <p class="mb-2 text-xs text-[#8e9bb0]">提现到</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="channel in channels"
                :key="channel.value"
                @click="selectedChannel = channel.value"
                class="rounded-xl border px-3 py-2 text-sm font-bold btn-interact"
                :class="selectedChannel === channel.value ? 'border-[#c99b18] bg-[#243447] text-[#f2c24a]' : 'border-[#304255] bg-[#101b28] text-[#c9d5e2]'"
              >
                {{ channel.label }}
              </button>
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs text-[#8e9bb0]">提现金额</p>
            <div class="flex items-center rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3">
              <span class="mr-3 text-lg font-bold text-[#f2c24a]">¥</span>
              <input
                v-model="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="请输入提现金额"
                class="w-full bg-transparent text-white outline-none placeholder:text-[#6f8093]"
              />
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs text-[#8e9bb0]">短信验证码</p>
            <div class="mb-2">
              <input
                v-model="mobile"
                type="tel"
                maxlength="11"
                placeholder="请输入手机号"
                class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
              />
              <p v-if="mobile && !mobileValid" class="mt-1 text-[11px] text-[#ff7d75]">请输入 11 位手机号</p>
            </div>
            <div class="flex gap-2">
              <input
                v-model="smsCode"
                type="text"
                placeholder="输入验证码"
                class="flex-1 rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
              />
              <button
                @click="sendSms"
                class="rounded-2xl border border-[#304255] px-4 py-3 text-xs font-bold btn-interact"
                :class="canSendSms ? 'text-[#f2c24a] bg-[#223244]' : 'text-[#72859a] bg-[#1a2735]'"
                :disabled="!canSendSms"
              >
                {{ sendingSms ? '发送中...' : (smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码') }}
              </button>
            </div>
          </div>

          <button
            @click="submitWithdraw"
            class="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white btn-interact"
            :class="canSubmit ? 'bg-[#19c58a]' : 'bg-[#304255] text-[#72859a]'"
            :disabled="!canSubmit"
          >
            {{ submiting ? '提交中...' : '确认提现' }}
          </button>

          <p class="text-[11px] text-[#8e9bb0]">提交成功后将显示“到账中”，预计 1-24 小时到账。</p>
        </div>
      </div>
    </div>
  </teleport>
</template>
