import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../components/AdminLayout.vue'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import UsersView from '../views/UsersView.vue'
import TradesView from '../views/TradesView.vue'
import FundsView from '../views/FundsView.vue'
import LeaderboardView from '../views/LeaderboardView.vue'
import RiskView from '../views/RiskView.vue'
import AuditView from '../views/AuditView.vue'
import ReportsView from '../views/ReportsView.vue'

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { title: '管理员登录', public: true } },
  {
    path: '/',
    component: AdminLayout,
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: DashboardView, meta: { title: '首页仪表盘' } },
      { path: 'users', name: 'users', component: UsersView, meta: { title: '用户管理' } },
      { path: 'trades', name: 'trades', component: TradesView, meta: { title: '交易管理' } },
      { path: 'funds', name: 'funds', component: FundsView, meta: { title: '资金管理' } },
      { path: 'leaderboard', name: 'leaderboard', component: LeaderboardView, meta: { title: '排行榜治理' } },
      { path: 'risk', name: 'risk', component: RiskView, meta: { title: '权限与风控' } },
      { path: 'audit', name: 'audit', component: AuditView, meta: { title: '审计追溯' } },
      { path: 'reports', name: 'reports', component: ReportsView, meta: { title: '报表中心' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('admin_token')
  if (!to.meta.public && !isAuthenticated) {
    next({ name: 'login' })
    return
  }
  if (to.name === 'login' && isAuthenticated) {
    next({ name: 'dashboard' })
    return
  }
  next()
})

router.afterEach((to) => {
  document.title = `金影子后台 - ${to.meta.title || '管理台'}`
})

export default router
