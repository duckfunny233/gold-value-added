<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Logo from '../../components/Logo.vue'
import { ArrowLeft, Loader2, Upload, X, Image } from 'lucide-vue-next'
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
const proofFile = ref(null)
const proofPreview = ref('')

const handleProofUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
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
let timer = null

const startCountdown = async () => {
  if (countdown.value > 0 || !phone.value) return
  
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

const handleRegister = async () => {
  if (!username.value || !phone.value || !otp.value || !password.value || !realName.value || !idNumber.value) {
    showToast(t('auth.register.fillAll'))
    return
  }

  isLoading.value = true
  try {
    await AuthService.register({
      username: username.value,
      phone: phone.value,
      otp: otp.value,
      password: password.value,
      realName: realName.value,
      idNumber: idNumber.value
    })

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
            <input 
              v-model="password"
              type="password" 
              :placeholder="t('auth.register.passwordPlaceholder')"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
            />
          </div>

          <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p class="text-[10px] text-gray-400 mb-3 uppercase tracking-wider font-bold">{{ t('auth.register.idMaterial') }}</p>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.register.realName') }}</label>
                <input 
                  v-model="realName"
                  type="text" 
                  :placeholder="t('auth.register.realNamePlaceholder')"
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.register.idNumber') }}</label>
                <input 
                  v-model="idNumber"
                  type="text" 
                  :placeholder="t('auth.register.idNumberPlaceholder')"
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
                />
                <p v-if="idNumber" class="text-[10px] text-gray-400 mt-1 ml-1">{{ t('auth.register.preview') }} {{ maskedIdNumber }}</p>
              </div>

              <div class="pt-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('auth.register.idMaterial') }}</label>
                <div class="flex flex-wrap gap-2 mb-3">
                  <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] rounded-lg">{{ t('auth.register.workCert') }}</span>
                  <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] rounded-lg">{{ t('auth.register.bizLicense') }}</span>
                  <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] rounded-lg">{{ t('auth.register.workProof') }}</span>
                </div>
                
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
          </div>

          <button 
            @click="handleRegister"
            :disabled="isLoading"
            class="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 mt-4 flex items-center justify-center gap-2 btn-interact"
          >
            <Loader2 v-if="isLoading" class="animate-spin" :size="20" />
            {{ isLoading ? t('common.submitting') : t('auth.register.registerBtn') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>