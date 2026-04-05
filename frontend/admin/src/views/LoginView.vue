<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const error = ref('')

const form = reactive({
  username: '',
  password: '',
})

const submit = async () => {
  error.value = ''
  if (!form.username || !form.password) {
    error.value = '请输入账号和密码'
    return
  }

  loading.value = true
  try {
    await new Promise((resolve) => setTimeout(resolve, 500))
    localStorage.setItem('admin_token', `admin-${Date.now()}`)
    localStorage.setItem('admin_user', form.username)
    router.push('/dashboard')
  } catch (e) {
    error.value = '登录失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-shell" id="main-content">
    <section class="login-card" aria-labelledby="login-title">
      <h1 id="login-title">管理员登录</h1>
      <p>登录后进入金影子后台管理系统</p>

      <form @submit.prevent="submit" class="login-form">
        <label>
          账号
          <input v-model="form.username" autocomplete="username" placeholder="请输入管理员账号" />
        </label>

        <label>
          密码
          <input v-model="form.password" type="password" autocomplete="current-password" placeholder="请输入密码" />
        </label>

        <p v-if="error" class="login-error" role="alert">{{ error }}</p>

        <button class="primary" type="submit" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
    </section>
  </main>
</template>

