<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Logo from '../../components/Logo.vue'
import { ArrowLeft, Loader2 } from 'lucide-vue-next'
import { AuthService } from '../../services/auth'
import { useToast } from '../../composables/useToast'

const { t } = useI18n()
const router = useRouter()
const { showToast } = useToast()
const phone = ref('')
const otp = ref('')
const newPassword = ref('')
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
  
    const handleReset = async () => {
      if (!phone.value || !otp.value || !newPassword.value) {
        showToast(t('auth.forgotPassword.fillAll'))
        return
      }
  
      isLoading.value = true
      try {
        await AuthService.resetPassword({
          phone: phone.value,
          otp: otp.value,
          newPassword: newPassword.value
        })
  
        showToast(t('common.success'))
        router.push('/login')
      } catch (error) {
        console.error('Reset failed:', error)
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
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center">{{ t('auth.forgotPassword.title') }}</h2>
        
        <div class="card-base p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.forgotPassword.phone') }}</label>
            <div class="flex gap-2">
              <input 
                v-model="phone"
                type="tel" 
                :placeholder="t('auth.forgotPassword.phonePlaceholder')"
                class="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
              />
              <button 
                @click="startCountdown"
                :disabled="countdown > 0"
                class="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm whitespace-nowrap disabled:opacity-50 btn-interact"
              >
                {{ countdown > 0 ? `${countdown}s` : t('auth.forgotPassword.getCode') }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.forgotPassword.code') }}</label>
            <input 
              v-model="otp"
              type="text" 
              :placeholder="t('auth.forgotPassword.codePlaceholder')"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.forgotPassword.newPassword') }}</label>
            <input 
              v-model="newPassword"
              type="password" 
              :placeholder="t('auth.forgotPassword.newPasswordPlaceholder')"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all"
            />
          </div>

          <button 
            @click="handleReset"
            :disabled="isLoading"
            class="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 mt-4 flex items-center justify-center gap-2 btn-interact"
          >
            <Loader2 v-if="isLoading" class="animate-spin" :size="20" />
            {{ isLoading ? t('common.submitting') : t('auth.forgotPassword.confirmReset') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>