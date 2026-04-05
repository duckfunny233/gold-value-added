<script setup>
import Toast from './components/common/Toast.vue'
import { useToast } from './composables/useToast'

const { message, visible, duration } = useToast()
</script>

<template>
  <router-view v-slot="{ Component }">
    <keep-alive :include="['MainLayout', 'NewsList']">
      <component :is="Component" />
    </keep-alive>
  </router-view>
  
  <Toast 
    v-model:visible="visible" 
    :message="message" 
    :duration="duration" 
  />
</template>

<style>
/* Global styles */
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* Transitions for page changes can be added here if needed globally */
</style>