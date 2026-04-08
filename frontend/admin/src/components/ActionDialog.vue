<script setup>
const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  confirmText: {
    type: String,
    default: '确认',
  },
  cancelText: {
    type: String,
    default: '关闭',
  },
  confirmDisabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  danger: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])

function handleBackdropClick(event) {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click="handleBackdropClick">
    <section class="dialog" role="dialog" aria-modal="true" :aria-label="title">
      <header class="dialog-head">
        <div>
          <h2>{{ title }}</h2>
          <p v-if="description" class="muted">{{ description }}</p>
        </div>
      </header>

      <div class="dialog-body">
        <slot />
      </div>

      <footer class="dialog-actions">
        <button type="button" @click="emit('close')">{{ cancelText }}</button>
        <button
          type="button"
          :class="danger ? 'warn' : 'primary'"
          :disabled="confirmDisabled || loading"
          @click="emit('confirm')"
        >
          {{ loading ? '处理中...' : confirmText }}
        </button>
      </footer>
    </section>
  </div>
</template>
