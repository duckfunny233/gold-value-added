<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LogoLarge from '../../components/LogoLarge.vue'
import { AuthService } from '../../services/auth'

const { t } = useI18n()
const router = useRouter()
const username = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  if (!username.value || !password.value) {
    errorMessage.value = t('auth.login.fillAll')
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await AuthService.login(username.value, password.value)
    
    // 瀛樺偍鐧诲綍鐘舵€佸拰鐢ㄦ埛淇℃伅
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('token', result.data.token)
    localStorage.setItem('user', JSON.stringify(result.data.user))
    
    router.push('/home')
  } catch (error) {
    errorMessage.value = error.message || t('auth.login.loginFailed')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 px-4 py-12 flex flex-col items-center">
    <div class="w-full max-w-md space-y-8 my-auto">
      <div class="flex justify-center">
        <LogoLarge />
      </div>
      
      <div class="card-base p-8 space-y-6">
        <h2 class="text-2xl font-bold text-center text-gray-900 dark:text-white">{{ t('auth.login.title') }}</h2>
        
        <div v-if="errorMessage" class="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
          {{ errorMessage }}
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.login.username') }}</label>
            <input 
              v-model="username"
              type="text" 
              :placeholder="t('auth.login.usernamePlaceholder')"
              :disabled="isLoading"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all disabled:opacity-50"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.login.password') }}</label>
            <input 
              v-model="password"
              type="password" 
              :placeholder="t('auth.login.passwordPlaceholder')"
              :disabled="isLoading"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white dark:bg-gray-900 outline-none transition-all disabled:opacity-50"
              @keyup.enter="handleLogin"
            />
          </div>
        </div>

        <button 
          @click="handleLogin"
          :disabled="isLoading"
          class="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-70 btn-interact"
        >
          <span v-if="isLoading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {{ isLoading ? t('common.submitting') : t('auth.login.loginBtn') }}
        </button>

        <div class="flex justify-start text-sm px-1">
          <router-link to="/register" class="text-primary hover:underline font-medium">{{ t('auth.login.registerLink') }}</router-link>
        </div>

        <p class="px-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('auth.login.keyNotice') }}
        </p>
      </div>
    </div>
  </div>
</template>
