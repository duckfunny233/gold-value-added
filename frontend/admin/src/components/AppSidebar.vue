<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AdminAuthService } from '../services/auth'
import { MVP_MENU_ORDER } from '../constants/mvp-menu'

const route = useRoute()
const router = useRouter()

const menus = computed(() => {
  const layoutRoute = router.options.routes.find((item) => item.path === '/')
  const children = layoutRoute?.children || []
  const orderIndex = (path) => {
    const index = MVP_MENU_ORDER.indexOf(path)
    return index === -1 ? 999 : index
  }

  return children
    .filter((child) => child.meta?.title && !child.meta?.mvpHidden && child.path)
    .sort((a, b) => orderIndex(a.path) - orderIndex(b.path))
    .map((child) => ({
      path: `/${child.path}`,
      label: child.meta.title,
    }))
})

const activePath = computed(() => route.path)

const logout = () => {
  AdminAuthService.logout()
  router.push('/login')
}
</script>

<template>
  <nav class="sidebar" aria-label="主导航">
    <div class="brand">金影子后台</div>
    <ul class="nav-list">
      <li v-for="item in menus" :key="item.path">
        <RouterLink
          :to="item.path"
          class="nav-link"
          :class="{ active: activePath === item.path }"
        >
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>

    <div class="sidebar-footer">
      <button @click="logout" class="logout-btn" type="button">退出登录</button>
    </div>
  </nav>
</template>
