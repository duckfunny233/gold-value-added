<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Logo from '../../components/Logo.vue'
import { ArrowLeft, Loader2, Upload, X, Image, FileText, CreditCard, Building2, Briefcase, Eye, EyeOff } from 'lucide-vue-next'
import { AuthService } from '../../services/auth'
import { useToast } from '../../composables/useToast'

const { t } = useI18n()
const router = useRouter()
const { showToast } = useToast()
const username = ref('')
const phone = ref('')
const otp = ref('')
const password = ref('')
const realName = ref('')
const idNumber = ref('')

// 身份证正反面
const idCardFront = ref(null)
const idCardFrontPreview = ref('')
const idCardBack = ref(null)
const idCardBackPreview = ref('')

// 证明材料
const proofType = ref('') // workCert, bizLicense, workProof, incomeProof, other
const proofFile = ref(null)
const proofPreview = ref('')

const proofTypes = [
  { value: 'workCert', label: t('auth.register.workCert'), icon: Briefcase },
  { value: 'bizLicense', label: t('auth.register.bizLicense'), icon: Building2 },
  { value: 'workProof', label: t('auth.register.workProof'), icon: FileText },
  { value: 'incomeProof', label: t('auth.register.incomeProof'), icon: CreditCard },
  { value: 'other', label: t('auth.register.otherProof'), icon: FileText },
]

const handleIdCardFrontUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (!file.type.startsWith('image/')) {
      showToast(t('auth.register.uploadImageOnly'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('auth.register.uploadTooLarge'))
      return
    }
    idCardFront.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      idCardFrontPreview.value = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const handleIdCardBackUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (!file.type.startsWith('image/')) {
      showToast(t('auth.register.uploadImageOnly'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('auth.register.uploadTooLarge'))
      return
    }
    idCardBack.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      idCardBackPreview.value = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const clearIdCardFront = () => {
  idCardFront.value = null
  idCardFrontPreview.value = ''
}

const clearIdCardBack = () => {
  idCardBack.value = null
  idCardBackPreview.value = ''
}

const handleProofUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (!file.type.startsWith('image/')) {
      showToast(t('auth.register.uploadImageOnly'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('auth.register.uploadTooLarge'))
      return
    }
    proofFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      proofPreview.value = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const clearProof = () => {
  proofFile.value = null
  proofPreview.value = ''
}

const countdown = ref(0)
const isLoading = ref(false)
const showPassword = ref(false)
let timer = null

const startCountdown = async () => {
  if (countdown.value > 0 || !phone.value) return
  
  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(phone.value)) {
    showToast(t('auth.register.phoneInvalid'))
    return
  }
  
  try {
    await AuthService.sendOtp(phone.value)
    
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (err) {
    // apiFetch handles global toast
  }
}

const maskedIdNumber = computed(() => {
  if (!idNumber.value) return ''
  if (idNumber.value.length < 10) return idNumber.value
  return idNumber.value.substring(0, 6) + '********' + idNumber.value.substring(idNumber.value.length - 4)
})

// 验证身份证号
const validateIdNumber = (idNum) => {
  const idRegex = /^\d{17}[\dXx]$/
  if (!idRegex.test(idNum)) return false
  
  // 验证出生日期
  const year = parseInt(idNum.substring(6, 10))
  const month = parseInt(idNum.substring(10, 12))
  const day = parseInt(idNum.substring(12, 14))
  const birthDate = new Date(year, month - 1, day)
  const now = new Date()
  
  if (birthDate > now) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  
  // 验证校验码
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idNum[i]) * weights[i]
  }
  const checkCode = checkCodes[sum % 11]
  return idNum[17].toUpperCase() === checkCode
}

const canSubmit = computed(() => {
  return username.value && 
         phone.value && 
         otp.value && 
         password.value && 
         realName.value && 
         idNumber.value &&
         idCardFront.value &&
         idCardBack.value &&
         proofType.value &&
         proofFile.value
})

const handleRegister = async () => {
  // 基础验证
  if (!username.value || !phone.value || !otp.value || !password.value || !realName.value || !idNumber.value) {
    showToast(t('auth.register.fillAll'))
    return
  }

  // 用户名验证
  if (username.value.length < 6 || username.value.length > 18) {
    showToast(t('auth.register.usernameInvalid'))
    return
  }

  // 手机号验证
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(phone.value)) {
    showToast(t('auth.register.phoneInvalid'))
    return
  }

  // 密码验证
  if (password.value.length < 6 || password.value.length > 16) {
    showToast(t('auth.register.passwordInvalid'))
    return
  }

  // 真实姓名验证
  if (realName.value.length < 2 || realName.value.length > 20) {
    showToast(t('auth.register.realNameInvalid'))
    return
  }

  // 身份证号验证
  if (!validateIdNumber(idNumber.value)) {
    showToast(t('auth.register.idNumberInvalid'))
    return
  }

  // 身份证上传验证
  if (!idCardFront.value || !idCardBack.value) {
    showToast(t('auth.register.idCardRequired'))
    return
  }

  // 证明材料验证
  if (!proofType.value) {
    showToast(t('auth.register.proofTypeRequired'))
    return
  }

  if (!proofFile.value) {
    showToast(t('auth.register.proofFileRequired'))
    return
  }

  isLoading.value = true
  try {
    // 构建表单数据
    const formData = new FormData()
    formData.append('username', username.value)
    formData.append('phone', phone.value)
    formData.append('otp', otp.value)
    formData.append('password', password.value)
    formData.append('realName', realName.value)
    formData.append('idNumber', idNumber.value)
    formData.append('idCardFront', idCardFront.value)
    formData.append('idCardBack', idCardBack.value)
    formData.append('proofType', proofType.value)
    formData.append('proofFile', proofFile.value)

    await AuthService.registerWithFiles(formData)

    showToast(t('auth.register.success'))
    router.push('/login')
  } catch (error) {
    console.error('Registration failed:', error)
    // apiFetch handles global toast
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 px-4 py-6 flex flex-col items-center">
    <div class="w-full max-w-md relative">
      <!-- Header with absolute back button -->
      <div class="relative flex items-center justify-center mb-8 min-h-[48px]">
        <button 
          @click="router.back()" 
          class="absolute left-0 top-1/2 -translate-y-1/2 z-[60] p-2 -ml-2 text-gray-600 dark:text-gray-400 btn-interact rounded-full"
        >
          <ArrowLeft :size="24" />
        </button>
        <Logo class="relative z-10" />
      </div>

      <div class="space-y-6 pb-12">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center">{{ t('auth.register.title') }}</h2>
        
        <div class="card-base p-6 space-y-4">
          <!-- Username -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.register.username') }}</label>
            <input 
              v-model="username"
              type="text" 
              :placeholder="t('auth.register.usernamePlaceholder')"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
            />
          </div>

          <!-- Phone & OTP -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.register.phone') }}</label>
            <div class="flex gap-2">
              <input 
                v-model="phone"
                type="tel" 
                :placeholder="t('auth.register.phonePlaceholder')"
                class="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
              />
              <button 
                @click="startCountdown"
                :disabled="countdown > 0"
                class="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm whitespace-nowrap disabled:opacity-50 btn-interact"
              >
                {{ countdown > 0 ? `${countdown}s` : t('auth.register.getCode') }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.register.code') }}</label>
            <input 
              v-model="otp"
              type="text" 
              :placeholder="t('auth.register.codePlaceholder')"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
            />
          </div>

          <!-- Password -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.register.password') }}</label>
            <div class="relative">
              <input 
                v-model="password"
                :type="showPassword ? 'text' : 'password'" 
                :placeholder="t('auth.register.passwordPlaceholder')"
                class="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
              >
                <Eye v-if="!showPassword" :size="20" />
                <EyeOff v-else :size="20" />
              </button>
            </div>
          </div>

          <!-- 实名认证区域 -->
          <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p class="text-[10px] text-gray-400 mb-3 uppercase tracking-wider font-bold">{{ t('auth.register.realNameVerify') }}</p>
            
            <div class="space-y-4">
              <!-- 真实姓名 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.register.realName') }}</label>
                <input 
                  v-model="realName"
                  type="text" 
                  :placeholder="t('auth.register.realNamePlaceholder')"
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
                />
              </div>

              <!-- 身份证号 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.register.idNumber') }}</label>
                <input 
                  v-model="idNumber"
                  type="text" 
                  maxlength="18"
                  :placeholder="t('auth.register.idNumberPlaceholder')"
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
                />
                <p v-if="idNumber" class="text-[10px] text-gray-400 mt-1 ml-1">{{ t('auth.register.preview') }} {{ maskedIdNumber }}</p>
              </div>

              <!-- 身份证正面上传 -->
              <div class="pt-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('auth.register.idCardFront') }}</label>
                <div class="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-colors hover:border-primary/50">
                  <input 
                    type="file" 
                    accept="image/*" 
                    @change="handleIdCardFrontUpload"
                    class="hidden" 
                    id="idcard-front-upload"
                  />
                  <label 
                    v-if="!idCardFrontPreview" 
                    for="idcard-front-upload" 
                    class="flex flex-col items-center justify-center cursor-pointer py-2"
                  >
                    <Upload class="text-gray-400 mb-2" :size="32" />
                    <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('auth.register.uploadIdCardFront') }}</span>
                    <span class="text-[10px] text-gray-400 mt-1">{{ t('auth.register.uploadFormat') }}</span>
                  </label>
                  
                  <div v-else class="relative">
                    <div class="flex items-center gap-4">
                      <div class="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 flex-shrink-0">
                        <img :src="idCardFrontPreview" alt="ID Card Front" class="w-full h-full object-cover" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{{ idCardFront?.name }}</p>
                        <p class="text-[10px] text-gray-400 mt-1">{{ t('auth.register.uploadChange') }}</p>
                      </div>
                      <button 
                        @click="clearIdCardFront" 
                        class="p-2 text-gray-400 hover:text-danger transition-colors btn-interact"
                      >
                        <X :size="20" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 身份证反面上传 -->
              <div class="pt-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('auth.register.idCardBack') }}</label>
                <div class="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-colors hover:border-primary/50">
                  <input 
                    type="file" 
                    accept="image/*" 
                    @change="handleIdCardBackUpload"
                    class="hidden" 
                    id="idcard-back-upload"
                  />
                  <label 
                    v-if="!idCardBackPreview" 
                    for="idcard-back-upload" 
                    class="flex flex-col items-center justify-center cursor-pointer py-2"
                  >
                    <Upload class="text-gray-400 mb-2" :size="32" />
                    <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('auth.register.uploadIdCardBack') }}</span>
                    <span class="text-[10px] text-gray-400 mt-1">{{ t('auth.register.uploadFormat') }}</span>
                  </label>
                  
                  <div v-else class="relative">
                    <div class="flex items-center gap-4">
                      <div class="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 flex-shrink-0">
                        <img :src="idCardBackPreview" alt="ID Card Back" class="w-full h-full object-cover" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{{ idCardBack?.name }}</p>
                        <p class="text-[10px] text-gray-400 mt-1">{{ t('auth.register.uploadChange') }}</p>
                      </div>
                      <button 
                        @click="clearIdCardBack" 
                        class="p-2 text-gray-400 hover:text-danger transition-colors btn-interact"
                      >
                        <X :size="20" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 证明材料区域 -->
          <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p class="text-[10px] text-gray-400 mb-3 uppercase tracking-wider font-bold">{{ t('auth.register.proofMaterial') }}</p>
            
            <!-- 证明材料类型选择 -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('auth.register.selectProofType') }}</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="type in proofTypes"
                  :key="type.value"
                  type="button"
                  @click="proofType = type.value"
                  :class="[
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all btn-interact',
                    proofType === type.value 
                      ? 'bg-primary/10 border border-primary text-primary' 
                      : 'bg-gray-100 dark:bg-gray-700 border border-transparent text-gray-600 dark:text-gray-300'
                  ]"
                >
                  <component :is="type.icon" :size="16" />
                  <span class="text-xs">{{ type.label }}</span>
                </button>
              </div>
            </div>

            <!-- 证明材料上传 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('auth.register.uploadProof') }}</label>
              <div class="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-colors hover:border-primary/50">
                <input 
                  type="file" 
                  accept="image/*" 
                  @change="handleProofUpload"
                  class="hidden" 
                  id="proof-upload"
                />
                <label 
                  v-if="!proofPreview" 
                  for="proof-upload" 
                  class="flex flex-col items-center justify-center cursor-pointer py-2"
                >
                  <Upload class="text-gray-400 mb-2" :size="32" />
                  <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('auth.register.uploadArea') }}</span>
                  <span class="text-[10px] text-gray-400 mt-1">{{ t('auth.register.uploadFormat') }}</span>
                </label>
                
                <div v-else class="relative">
                  <div class="flex items-center gap-4">
                    <div class="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 flex-shrink-0">
                      <img :src="proofPreview" alt="Proof preview" class="w-full h-full object-cover" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{{ proofFile?.name }}</p>
                      <p class="text-[10px] text-gray-400 mt-1">{{ t('auth.register.uploadChange') }}</p>
                    </div>
                    <button 
                      @click="clearProof" 
                      class="p-2 text-gray-400 hover:text-danger transition-colors btn-interact"
                    >
                      <X :size="20" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button 
            @click="handleRegister"
            :disabled="isLoading || !canSubmit"
            class="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 mt-4 flex items-center justify-center gap-2 btn-interact disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="isLoading" class="animate-spin" :size="20" />
            {{ isLoading ? t('common.submitting') : t('auth.register.registerBtn') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
