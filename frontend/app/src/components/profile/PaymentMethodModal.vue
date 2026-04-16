<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, CreditCard, Wallet, QrCode, Trash2, Check } from 'lucide-vue-next'
import { UserService } from '../../services/user'
import { showToast } from '../../composables/useToast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  existingMethod: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'success'])

const { t } = useI18n()

// 收款方式类型
const methodTypes = [
  { key: 'bankcard', label: t('settings.paymentMethod.bankcard'), icon: CreditCard },
  { key: 'alipay', label: t('settings.paymentMethod.alipay'), icon: Wallet },
  { key: 'wechat', label: t('settings.paymentMethod.wechat'), icon: QrCode },
]

// 当前步骤：'select' | 'form' | 'confirm'
const step = ref('select')
const selectedType = ref('')
const loading = ref(false)

// 表单数据
const formData = ref({
  // 银行卡
  bankcardName: '',
  bankcardNumber: '',
  bankName: '',
  // 支付宝
  alipayName: '',
  alipayAccount: '',
  // 微信
  wechatName: '',
  wechatQrCode: '',
})

// 预览图片
const qrCodePreview = ref('')

// 重置表单
const resetForm = () => {
  formData.value = {
    bankcardName: '',
    bankcardNumber: '',
    bankName: '',
    alipayName: '',
    alipayAccount: '',
    wechatName: '',
    wechatQrCode: '',
  }
  qrCodePreview.value = ''
  step.value = 'select'
  selectedType.value = ''
}

// 监听弹窗显示状态
watch(() => props.visible, (val) => {
  if (!val) {
    setTimeout(resetForm, 300)
  }
})

// 选择收款方式类型
const selectType = (type) => {
  selectedType.value = type
  step.value = 'form'
}

// 返回选择步骤
const backToSelect = () => {
  if (props.existingMethod) {
    emit('close')
  } else {
    step.value = 'select'
    selectedType.value = ''
  }
}

// 处理二维码上传
const handleQrCodeUpload = (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    showToast(t('settings.paymentMethod.uploadImageOnly'))
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast(t('settings.paymentMethod.uploadTooLarge'))
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    qrCodePreview.value = e.target.result
    formData.value.wechatQrCode = e.target.result
  }
  reader.readAsDataURL(file)
}

// 表单验证
const isFormValid = computed(() => {
  switch (selectedType.value) {
    case 'bankcard':
      return formData.value.bankcardName.trim() &&
             formData.value.bankcardNumber.trim() &&
             formData.value.bankName.trim()
    case 'alipay':
      return formData.value.alipayName.trim() &&
             formData.value.alipayAccount.trim()
    case 'wechat':
      return formData.value.wechatName.trim() &&
             formData.value.wechatQrCode
    default:
      return false
  }
})

// 提交绑定
const submitBinding = async () => {
  if (!isFormValid.value || loading.value) return

  loading.value = true
  try {
    let payload = { type: selectedType.value }
    
    switch (selectedType.value) {
      case 'bankcard':
        payload = {
          ...payload,
          name: formData.value.bankcardName.trim(),
          account: formData.value.bankcardNumber.trim(),
          bankName: formData.value.bankName.trim(),
        }
        break
      case 'alipay':
        payload = {
          ...payload,
          name: formData.value.alipayName.trim(),
          account: formData.value.alipayAccount.trim(),
        }
        break
      case 'wechat':
        payload = {
          ...payload,
          name: formData.value.wechatName.trim(),
          qrCode: formData.value.wechatQrCode,
        }
        break
    }

    await UserService.bindPaymentMethod(payload)
    showToast(t('settings.paymentMethod.bindSuccess'))
    emit('success', payload)
    emit('close')
  } catch (error) {
    showToast(error.message || t('settings.paymentMethod.bindFailed'))
  } finally {
    loading.value = false
  }
}

// 解绑收款方式
const unbindMethod = async () => {
  if (loading.value) return
  
  loading.value = true
  try {
    await UserService.unbindPaymentMethod()
    showToast(t('settings.paymentMethod.unbindSuccess'))
    emit('success', null)
    emit('close')
  } catch (error) {
    showToast(error.message || t('settings.paymentMethod.unbindFailed'))
  } finally {
    loading.value = false
  }
}

// 获取当前选中类型的图标
const currentIcon = computed(() => {
  const method = methodTypes.find(m => m.key === selectedType.value)
  return method?.icon || CreditCard
})

// 获取当前选中类型的标签
const currentLabel = computed(() => {
  const method = methodTypes.find(m => m.key === selectedType.value)
  return method?.label || ''
})
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[140] flex items-end justify-center">
      <div class="absolute inset-0 bg-black/60" @click="emit('close')"></div>
      
      <div class="relative w-full max-h-[90vh] overflow-y-auto rounded-t-[28px] border border-[#304255] bg-[#162331] p-5 text-white shadow-2xl">
        <!-- 头部 -->
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#223244] text-[#f2c24a]">
              <component :is="step === 'select' ? CreditCard : currentIcon" :size="22" />
            </div>
            <div>
              <h3 class="text-lg font-bold">
                {{ step === 'select' ? t('settings.paymentMethod.selectTitle') : t('settings.paymentMethod.bindTitle', { type: currentLabel }) }}
              </h3>
              <p class="text-xs text-[#8e9bb0]">
                {{ step === 'select' ? t('settings.paymentMethod.selectDesc') : t('settings.paymentMethod.bindDesc') }}
              </p>
            </div>
          </div>
          <button @click="emit('close')" class="text-[#8e9bb0] btn-interact p-2">
            <X :size="20" />
          </button>
        </div>

        <!-- 步骤1：选择收款方式 -->
        <div v-if="step === 'select'" class="space-y-4">
          <div class="grid grid-cols-1 gap-3">
            <button
              v-for="method in methodTypes"
              :key="method.key"
              @click="selectType(method.key)"
              class="flex items-center gap-4 p-4 rounded-2xl border border-[#304255] bg-[#101b28] btn-interact hover:border-[#c99b18] transition-colors"
            >
              <div class="w-12 h-12 rounded-xl bg-[#223244] flex items-center justify-center text-[#f2c24a]">
                <component :is="method.icon" :size="24" />
              </div>
              <div class="flex-1 text-left">
                <p class="font-bold text-white">{{ method.label }}</p>
                <p class="text-xs text-[#8e9bb0]">{{ t(`settings.paymentMethod.${method.key}Desc`) }}</p>
              </div>
              <ChevronRight class="text-[#8e9bb0]" :size="20" />
            </button>
          </div>

          <!-- 已有绑定提示 -->
          <div v-if="existingMethod" class="mt-4 p-4 rounded-xl bg-[#223244]/50 border border-[#304255]">
            <div class="flex items-center gap-3 mb-3">
              <component :is="methodTypes.find(m => m.key === existingMethod.type)?.icon || CreditCard" :size="20" class="text-[#f2c24a]" />
              <span class="font-bold">{{ t('settings.paymentMethod.currentBound') }}</span>
            </div>
            <div class="text-sm text-[#8e9bb0] space-y-1">
              <p>{{ t('settings.paymentMethod.type') }}：{{ methodTypes.find(m => m.key === existingMethod.type)?.label }}</p>
              <p>{{ t('settings.paymentMethod.name') }}：{{ existingMethod.name }}</p>
              <p v-if="existingMethod.account">{{ t('settings.paymentMethod.account') }}：{{ existingMethod.account }}</p>
            </div>
            <button
              @click="unbindMethod"
              class="mt-3 flex items-center gap-2 text-[#ff7d75] text-sm btn-interact"
              :disabled="loading"
            >
              <Trash2 :size="16" />
              {{ loading ? t('common.processing') : t('settings.paymentMethod.unbind') }}
            </button>
          </div>
        </div>

        <!-- 步骤2：填写表单 -->
        <div v-else-if="step === 'form'" class="space-y-4">
          <button
            @click="backToSelect"
            class="text-sm text-[#8e9bb0] btn-interact flex items-center gap-1"
          >
            <ChevronLeft :size="16" />
            {{ t('common.back') }}
          </button>

          <!-- 银行卡表单 -->
          <template v-if="selectedType === 'bankcard'">
            <div>
              <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.paymentMethod.realName') }}</p>
              <input
                v-model="formData.bankcardName"
                type="text"
                :placeholder="t('settings.paymentMethod.realNamePlaceholder')"
                class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
              />
            </div>
            <div>
              <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.paymentMethod.bankName') }}</p>
              <input
                v-model="formData.bankName"
                type="text"
                :placeholder="t('settings.paymentMethod.bankNamePlaceholder')"
                class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
              />
            </div>
            <div>
              <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.paymentMethod.bankcardNumber') }}</p>
              <input
                v-model="formData.bankcardNumber"
                type="text"
                :placeholder="t('settings.paymentMethod.bankcardNumberPlaceholder')"
                class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
              />
            </div>
          </template>

          <!-- 支付宝表单 -->
          <template v-if="selectedType === 'alipay'">
            <div>
              <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.paymentMethod.realName') }}</p>
              <input
                v-model="formData.alipayName"
                type="text"
                :placeholder="t('settings.paymentMethod.realNamePlaceholder')"
                class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
              />
            </div>
            <div>
              <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.paymentMethod.alipayAccount') }}</p>
              <input
                v-model="formData.alipayAccount"
                type="text"
                :placeholder="t('settings.paymentMethod.alipayAccountPlaceholder')"
                class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
              />
            </div>
          </template>

          <!-- 微信表单 -->
          <template v-if="selectedType === 'wechat'">
            <div>
              <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.paymentMethod.realName') }}</p>
              <input
                v-model="formData.wechatName"
                type="text"
                :placeholder="t('settings.paymentMethod.realNamePlaceholder')"
                class="w-full rounded-2xl border border-[#304255] bg-[#101b28] px-4 py-3 text-white outline-none placeholder:text-[#6f8093]"
              />
            </div>
            <div>
              <p class="mb-2 text-xs text-[#8e9bb0]">{{ t('settings.paymentMethod.wechatQrCode') }}</p>
              <div
                class="relative w-full h-48 rounded-2xl border border-[#304255] bg-[#101b28] flex flex-col items-center justify-center overflow-hidden cursor-pointer btn-interact"
                @click="$refs.qrCodeInput.click()"
              >
                <input
                  ref="qrCodeInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleQrCodeUpload"
                />
                <template v-if="qrCodePreview">
                  <img :src="qrCodePreview" class="w-full h-full object-contain" />
                  <button
                    @click.stop="qrCodePreview = ''; formData.wechatQrCode = ''"
                    class="absolute top-2 right-2 w-8 h-8 rounded-full bg-[#ff7d75] text-white flex items-center justify-center btn-interact"
                  >
                    <X :size="16" />
                  </button>
                </template>
                <template v-else>
                  <QrCode :size="40" class="text-[#6f8093] mb-2" />
                  <p class="text-sm text-[#6f8093]">{{ t('settings.paymentMethod.uploadQrCode') }}</p>
                  <p class="text-xs text-[#8e9bb0] mt-1">{{ t('settings.paymentMethod.uploadQrCodeHint') }}</p>
                </template>
              </div>
            </div>
          </template>

          <button
            @click="submitBinding"
            class="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white btn-interact"
            :class="isFormValid ? 'bg-[#19c58a]' : 'bg-[#304255] text-[#72859a]'"
            :disabled="!isFormValid || loading"
          >
            {{ loading ? t('common.submitting') : t('settings.paymentMethod.confirmBind') }}
          </button>

          <p class="text-[11px] text-[#8e9bb0] text-center">
            {{ t('settings.paymentMethod.bindHint') }}
          </p>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script>
// 导入需要的图标
import { ChevronRight, ChevronLeft } from 'lucide-vue-next'
export default {
  components: {
    ChevronRight,
    ChevronLeft,
  },
}
</script>
