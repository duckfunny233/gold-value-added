<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

<template>
  <header class="page-header">
    <h1>{{ title }}</h1>
    <p v-if="description">{{ description }}</p>
    <slot />
  </header>
</template>
