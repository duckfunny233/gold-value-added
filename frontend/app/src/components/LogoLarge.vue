<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <img 
      src="../assets/images/jyz_logo_clear.png" 
      alt="Logo" 
      class="w-48 h-48 object-contain drop-shadow-lg" 
    />
    <div class="flex flex-col items-center text-center">
      <span class="font-bold text-3xl tracking-wider text-gray-900 dark:text-white">
        {{ t('logo.title') }}
      </span>
      <span class="text-sm text-gray-500 tracking-[0.3em] mt-2 font-medium">
        GOLD VALUE ADDED
      </span>
    </div>
  </div>
</template>
