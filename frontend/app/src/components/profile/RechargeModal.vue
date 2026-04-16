<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, WalletCards, ShieldAlert, UserCheck, Download, QrCode, CreditCard, Clock, CheckCircle, History } from 'lucide-vue-next'
import { UserService } from '../../services/user'
import { AuthService } from '../../services/auth'
import { showToast } from '../../composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'success'])
const { t, locale } = useI18n()

// 支付方式配置
const paymentMethods = [
  { 
    labelKey: 'settings.payment.wechat', 
    value: 'wechat',
    icon: 'wechat',
    qrCode: '/微信二维码测试.png'
  },
  { 
    labelKey: 'settings.payment.alipay', 
    value: 'alipay',
    icon: 'alipay',
    qrCode: '/支付宝二维码测试.png'
  },
]

// 本地存储键名
const STORAGE_KEY = 'jyz_recharge_orders'
const STORAGE_KEY_METHOD = 'jyz_default_payment_method'

const selectedMethod = ref('')
const amount = ref('')
const creating = ref(false)
const confirming = ref(false)
const order = ref(null)
const checkingVerification = ref(true)
const isVerified = ref(false)
const showPaymentStep = ref(false) // 是否显示支付步骤
const showOrderList = ref(false) // 是否显示订单列表

const amountValue = computed(() => Number(amount.value))
const canCreate = computed(() => amountValue.value > 0 && !creating.value && isVerified.value)

// 获取历史订单
const getRechargeOrders = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.warn('Failed to read recharge orders:', e)
  }
  return []
}

// 保存订单
const saveRechargeOrder = (orderData) => {
  try {
    const orders = getRechargeOrders()
    orders.unshift(orderData)
    // 只保留最近20条
    if (orders.length > 20) {
      orders.pop()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch (e) {
    console.warn('Failed to save recharge order:', e)
  }
}

// 更新订单状态
const updateOrderStatus = (orderId, status) => {
  try {
    const orders = getRechargeOrders()
    const index = orders.findIndex(o => o.orderId === orderId)
    if (index !== -1) {
      orders[index].status = status
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
    }
  } catch (e) {
    console.warn('Failed to update order status:', e)
  }
}

const rechargeOrders = ref(getRechargeOrders())

const reset = () => {
  selectedMethod.value = ''
  amount.value = ''
  creating.value = false
  confirming.value = false
  order.value = null
  showPaymentStep.value = false
  showOrderList.value = false
}

// 检查实名认证状态
const checkVerificationStatus = async () => {
  checkingVerification.value = true
  try {
    const localVerified = AuthService.isRealNameVerified()
    if (localVerified) {
      isVerified.value = true
      checkingVerification.value = false
      return
    }
    
    try {
      const profile = await UserService.getProfile()
      isVerified.value = profile.data?.realNameVerified || false
      
      if (isVerified.value) {
        const user = localStorage.getItem('user')
        if (user) {
          const userData = JSON.parse(user)
          userData.realNameVerified = true
          localStorage.setItem('user', JSON.stringify(userData))
        }
      }
    } catch (apiError) {
      console.warn('Failed to fetch profile for verification check:', apiError)
      isVerified.value = true
    }
  } catch (error) {
    console.error('Failed to check verification status:', error)
    isVerified.value = true
  } finally {
    checkingVerification.value = false
  }
}

watch(() => props.visible, (value) => {
  if (value) {
    checkVerificationStatus()
    rechargeOrders.value = getRechargeOrders()
  } else {
    reset()
  }
})

const selectPaymentMethod = async (method) => {
  selectedMethod.value = method
  
  // 选择支付方式后立即创建订单（状态：待支付）
  try {
    const response = await UserService.createRechargeOrder(method, amountValue.value)
    order.value = response.data
    
    // 保存订单到本地，状态为 pending（待支付）
    const orderData = {
      orderId: response.data.orderId,
      amount: amountValue.value,
      channel: method,
      status: 'pending', // 待支付
      createdAt: new Date().toISOString(),
      payTime: null,
      completeTime: null
    }
    saveRechargeOrder(orderData)
    rechargeOrders.value = getRechargeOrders()
  } catch (error) {
    showToast(error.message ? t(error.message) : t('settings.recharge.toast.createFailed'))
    selectedMethod.value = ''
  }
}

const goToPaymentStep = () => {
  if (!amount.value || amountValue.value <= 0) {
    showToast(t('settings.recharge.enterAmountFirst'))
    return
  }
  showPaymentStep.value = true
}

const goBackToAmount = () => {
  showPaymentStep.value = false
  selectedMethod.value = ''
}

const createOrder = async () => {
  if (!canCreate.value) return
  
  if (!isVerified.value) {
    showToast(t('settings.recharge.realNameRequired'))
    return
  }
  
  if (!selectedMethod.value) {
    showToast(t('settings.recharge.selectMethodFirst'))
    return
  }
  
  creating.value = true
  try {
    const response = await UserService.createRechargeOrder(selectedMethod.value, amountValue.value)
    order.value = response.data
    
    // 保存订单到本地
    const orderData = {
      orderId: response.data.orderId,
      amount: amountValue.value,
      channel: selectedMethod.value,
      status: 'pending', // pending, reviewing, completed
      createdAt: new Date().toISOString(),
      payTime: null,
      completeTime: null
    }
    saveRechargeOrder(orderData)
    rechargeOrders.value = getRechargeOrders()
    
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
    // 调用确认支付 API
    const response = await UserService.confirmRecharge(order.value.orderId)
    
    // 更新订单状态为审核中
    updateOrderStatus(order.value.orderId, 'reviewing')
    rechargeOrders.value = getRechargeOrders()
    
    emit('success', response.data)
    showToast(t('settings.recharge.toast.confirmSuccess'))
    
    // 重置并显示订单列表
    reset()
    showOrderList.value = true
  } catch (error) {
    showToast(error.message ? t(error.message) : t('settings.recharge.toast.confirmFailed'))
  } finally {
    confirming.value = false
  }
}

const goToRealNameVerify = () => {
  emit('close')
  window.location.href = '/settings/security'
}

const formatOrderTime = (timeStr) => {
  if (!timeStr) return '--'
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusText = (status) => {
  const statusMap = {
    'pending': t('settings.recharge.statusPending'),
    'reviewing': t('settings.recharge.statusReviewing'),
    'completed': t('settings.recharge.statusCompleted'),
    'failed': t('settings.recharge.statusFailed')
  }
  return statusMap[status] || status
}

const getStatusClass = (status) => {
  const classMap = {
    'pending': 'text-yellow-400',
    'reviewing': 'text-blue-400',
    'completed': 'text-green-400',
    'failed': 'text-red-400'
  }
  return classMap[status] || 'text-gray-400'
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

// 获取当前选中的支付方式详情
const currentMethod = computed(() => {
  return paymentMethods.find(m => m.value === selectedMethod.value)
})

// 下载二维码
const downloadQRCode = () => {
  const method = currentMethod.value
  if (!method || !method.qrCode) return
  
  const link = document.createElement('a')
  link.href = method.qrCode
  link.download = `${method.value}_qrcode.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  showToast(t('settings.recharge.qrDownloaded'))
}
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[130] flex items-end justify-center">
      <div class="absolute inset-0 bg-black/60" @click="emit('close')"></div>
      <div class="relative w-full rounded-t-[28px] border border-[#304255] bg-[#162331] p-5 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
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

        <!-- 实名认证状态检查中 -->
        <div v-if="checkingVerification" class="py-12 text-center">
          <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-[#8e9bb0]">{{ t('settings.recharge.checkingVerification') }}</p>
        </div>

        <!-- 未实名认证提示 -->
        <div v-else-if="!isVerified" class="py-8 text-center">
          <div class="w-16 h-16 bg-[#223244] rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert class="text-[#ff6a62]" :size="32" />
          </div>
          <h4 class="text-lg font-bold mb-2">{{ t('settings.recharge.realNameRequiredTitle') }}</h4>
          <p class="text-sm text-[#8e9bb0] mb-6">{{ t('settings.recharge.realNameRequiredDesc') }}</p>
          <button 
            @click="goToRealNameVerify"
            class="w-full rounded-2xl bg-[#ff5f56] px-4 py-3 text-sm font-bold text-white btn-interact flex items-center justify-center gap-2"
          >
            <UserCheck :size="18" />
            {{ t('settings.recharge.goToVerify') }}
          </button>
        </div>

        <!-- 充值记录列表 -->
        <div v-else-if="showOrderList" class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-lg font-bold">{{ t('settings.recharge.orderList') }}</h4>
            <button 
              @click="showOrderList = false"
              class="text-sm text-[#c99b18] btn-interact"
            >
              {{ t('settings.recharge.newRecharge') }}
            </button>
          </div>

          <div v-if="rechargeOrders.length === 0" class="py-12 text-center">
            <div class="w-16 h-16 bg-[#223244] rounded-full flex items-center justify-center mx-auto mb-4">
              <History class="text-[#8e9bb0]" :size="32" />
            </div>
            <p class="text-[#8e9bb0]">{{ t('settings.recharge.noOrders') }}</p>
          </div>

          <div v-else class="space-y-3 max-h-[400px] overflow-y-auto">
            <div 
              v-for="order in rechargeOrders" 
              :key="order.orderId"
              class="rounded-2xl border border-[#304255] bg-[#101b28] p-4"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-[#8e9bb0]">{{ t('settings.recharge.orderNo') }}{{ order.orderId }}</span>
                <span class="text-xs text-[#8e9bb0]">{{ formatOrderTime(order.createdAt) }}</span>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-bold text-[#f2c24a]">¥{{ Number(order.amount || 0).toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
                  <p class="text-xs text-[#8e9bb0]">{{ t(paymentMethods.find(m => m.value === order.channel)?.labelKey || order.channel) }}</p>
                </div>
                <div class="flex items-center gap-1" :class="getStatusClass(order.status)">
                  <Clock v-if="order.status === 'pending' || order.status === 'reviewing'" :size="14" />
                  <CheckCircle v-else-if="order.status === 'completed'" :size="14" />
                  <span class="text-sm font-medium">{{ getStatusText(order.status) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 提示文字 -->
          <div class="rounded-2xl bg-[#223244]/50 border border-[#304255] p-3 mt-4">
            <p class="text-xs text-[#8e9bb0] text-center">
              {{ t('settings.recharge.rechargeNotice') }}
            </p>
          </div>
        </div>

        <!-- 支付步骤 - 选择支付方式并显示二维码 -->
        <div v-else-if="showPaymentStep" class="space-y-4">
          <!-- 返回按钮 -->
          <button 
            @click="goBackToAmount"
            class="flex items-center gap-2 text-sm text-[#8e9bb0] btn-interact"
          >
            <X :size="16" />
            {{ t('common.back') }}
          </button>

          <!-- 显示充值金额 -->
          <div class="rounded-2xl bg-[#223244]/50 border border-[#304255] p-4 text-center">
            <p class="text-sm text-[#8e9bb0] mb-1">{{ t('settings.recharge.rechargeAmount') }}</p>
            <p class="text-3xl font-bold text-[#f2c24a]">¥{{ amountValue.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
          </div>

          <!-- 选择支付方式 -->
          <div v-if="!selectedMethod">
            <p class="text-sm text-[#8e9bb0] mb-3">{{ t('settings.recharge.selectPaymentMethod') }}</p>
            <div class="space-y-3">
              <button
                v-for="method in paymentMethods"
                :key="method.value"
                @click="selectPaymentMethod(method.value)"
                class="w-full rounded-2xl border border-[#304255] bg-[#101b28] p-4 flex items-center gap-4 btn-interact hover:border-[#c99b18] transition-colors"
              >
                <div class="w-12 h-12 rounded-xl flex items-center justify-center"
                  :class="method.value === 'wechat' ? 'bg-[#19c58a]/20' : 'bg-[#1677ff]/20'"
                >
                  <QrCode :size="24" 
                    :class="method.value === 'wechat' ? 'text-[#19c58a]' : 'text-[#1677ff]'" 
                  />
                </div>
                <div class="flex-1 text-left">
                  <p class="font-bold">{{ t(method.labelKey) }}</p>
                  <p class="text-xs text-[#8e9bb0]">{{ t('settings.recharge.qrCodePayment') }}</p>
                </div>
              </button>
            </div>
          </div>

          <!-- 显示二维码 -->
          <div v-else class="space-y-4">
            <div class="rounded-2xl border border-[#304255] bg-[#101b28] p-4">
              <div class="text-center">
                <div class="flex items-center justify-center gap-2 mb-3">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center"
                    :class="currentMethod?.value === 'wechat' ? 'bg-[#19c58a]/20' : 'bg-[#1677ff]/20'"
                  >
                    <QrCode :size="16" 
                      :class="currentMethod?.value === 'wechat' ? 'text-[#19c58a]' : 'text-[#1677ff]'" 
                    />
                  </div>
                  <p class="font-bold">{{ t(currentMethod.labelKey) }}{{ t('settings.recharge.payment') }}</p>
                </div>
                
                <div class="bg-white p-4 rounded-xl inline-block mb-3">
                  <img :src="currentMethod.qrCode" :alt="t(currentMethod.labelKey)" class="w-48 h-48 object-contain" />
                </div>
                
                <p class="text-sm text-[#8e9bb0] mb-3">{{ t('settings.recharge.saveAndPay') }}</p>
                
                <button 
                  @click="downloadQRCode"
                  class="flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-xl bg-[#223244] text-sm text-[#c99b18] btn-interact"
                >
                  <Download :size="16" />
                  {{ t('settings.recharge.downloadQR') }}
                </button>
              </div>
            </div>

            <!-- 提示文字 -->
            <div class="rounded-2xl bg-[#223244]/50 border border-[#304255] p-3">
              <p class="text-xs text-[#8e9bb0] text-center">
                {{ t('settings.recharge.rechargeNotice') }}
              </p>
            </div>

            <!-- 我已完成支付按钮 -->
            <button
              @click="confirmPaid"
              class="w-full rounded-2xl bg-[#19c58a] px-4 py-3 text-sm font-bold text-white btn-interact"
              :disabled="confirming"
            >
              {{ confirming ? t('settings.recharge.submitting') : t('settings.recharge.paidDone') }}
            </button>
          </div>
        </div>

        <!-- 第一步：输入充值金额 -->
        <div v-else class="space-y-4">
          <!-- 实名认证状态提示 -->
          <div class="rounded-2xl bg-[#19c58a]/10 border border-[#19c58a]/30 p-3 flex items-center gap-3">
            <div class="w-8 h-8 bg-[#19c58a]/20 rounded-full flex items-center justify-center flex-shrink-0">
              <UserCheck class="text-[#19c58a]" :size="16" />
            </div>
            <div>
              <p class="text-sm font-medium text-[#19c58a]">{{ t('settings.recharge.verifiedStatus') }}</p>
              <p class="text-xs text-[#8e9bb0]">{{ t('settings.recharge.canRecharge') }}</p>
            </div>
          </div>

          <!-- 充值记录入口 -->
          <button 
            @click="showOrderList = true"
            class="w-full rounded-2xl border border-[#304255] bg-[#101b28] p-3 flex items-center justify-between btn-interact"
          >
            <div class="flex items-center gap-3">
              <History :size="20" class="text-[#8e9bb0]" />
              <span class="text-sm">{{ t('settings.recharge.viewOrderList') }}</span>
            </div>
            <span class="text-xs text-[#8e9bb0]">{{ rechargeOrders.length }}{{ t('settings.recharge.orderCount') }}</span>
          </button>

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

          <!-- 提示文字 -->
          <div class="rounded-2xl bg-[#223244]/50 border border-[#304255] p-3">
            <p class="text-xs text-[#8e9bb0] text-center">
              {{ t('settings.recharge.rechargeNotice') }}
            </p>
          </div>

          <button
            @click="goToPaymentStep"
            class="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white btn-interact"
            :class="canCreate ? 'bg-[#ff5f56]' : 'bg-[#304255] text-[#72859a]'"
            :disabled="!canCreate"
          >
            {{ t('settings.recharge.nextStep') }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>
