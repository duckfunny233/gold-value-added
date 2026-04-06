<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AdminAuthService } from '../services/auth'

const route = useRoute()
const router = useRouter()

const menus = [
  { path: '/dashboard', label: '首页仪表盘' },
  { path: '/users', label: '用户管理' },
  { path: '/trades', label: '交易管理' },
  { path: '/funds', label: '资金管理' },
  { path: '/leaderboard', label: '排行榜治理' },
  { path: '/risk', label: '权限与风控' },
  { path: '/audit', label: '审计追溯' },
  { path: '/reports', label: '报表中心' },
]

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
