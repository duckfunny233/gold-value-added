<script setup>
import AppSidebar from './AppSidebar.vue'
</script>

<template>
  <div class="admin-shell">
    <AppSidebar />
    <main id="main-content" class="main-content" tabindex="-1">
      <RouterView />
    </main>
  </div>
</template>
