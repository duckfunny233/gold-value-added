<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-2">
    <img src="../assets/images/jyz_logo_clear.png" alt="Logo" class="w-12 h-12 object-contain rounded-full" />
    <span class="font-bold text-xl tracking-tight text-white">{{ t('logo.title') }}</span>
  </div>
</template>
