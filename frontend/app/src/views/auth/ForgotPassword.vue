<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from 'lucide-vue-next'
import Logo from '../../components/Logo.vue'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <div class="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 px-4 py-6 flex flex-col items-center">
    <div class="w-full max-w-md relative">
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
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center">{{ t('auth.forgotPassword.manualTitle') }}</h2>
        
        <div class="card-base p-6 space-y-4">
          <p class="text-sm text-gray-700 dark:text-gray-300 leading-7">
            {{ t('auth.forgotPassword.manualDesc1') }}
          </p>
          <p class="text-sm text-gray-700 dark:text-gray-300 leading-7">
            {{ t('auth.forgotPassword.manualDesc2') }}
          </p>
          <button
            @click="router.push('/login')"
            class="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 mt-2 btn-interact"
          >
            {{ t('auth.forgotPassword.manualBackLogin') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
