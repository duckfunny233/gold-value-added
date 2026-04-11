import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/auth/Login.vue'
import Register from '../views/auth/Register.vue'
import ForgotPassword from '../views/auth/ForgotPassword.vue'
import MainLayout from '../layouts/MainLayout.vue'
import Home from '../views/Home.vue'
import Chat from '../views/Chat.vue'
import Market from '../views/Market.vue'
import Trade from '../views/Trade.vue'
import Profile from '../views/Profile.vue'
import ChatDetail from '../views/ChatDetail.vue'
import NewsList from '../views/NewsList.vue'
import NewsDetail from '../views/NewsDetail.vue'
import GoldChain from '../views/GoldChain.vue'
import AddFriend from '../views/chat/AddFriend.vue'
import CreateGroup from '../views/chat/CreateGroup.vue'
import Scan from '../views/chat/Scan.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/register',
    name: 'Register',
    component: Register
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: ForgotPassword
  },
  {
    path: '/news',
    name: 'NewsList',
    component: NewsList
  },
  {
    path: '/news/:id',
    name: 'NewsDetail',
    component: NewsDetail
  },
  {
    path: '/activity/:id',
    name: 'ActivityDetail',
    component: NewsDetail
  },
  {
    path: '/chat/add-friend',
    name: 'AddFriend',
    component: AddFriend
  },
  {
    path: '/chat/create-group',
    name: 'CreateGroup',
    component: CreateGroup
  },
  {
    path: '/chat/scan',
    name: 'Scan',
    component: Scan
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: Home
      },
      {
        path: 'chat',
        name: 'Chat',
        component: Chat
      },
      {
        path: 'market',
        name: 'Market',
        component: Market
      },
      {
        path: 'trade',
        name: 'Trade',
        component: Trade
      },
      {
        path: 'profile',
        name: 'Profile',
        component: Profile
      },
      {
        path: 'gold-chain',
        name: 'GoldChain',
        component: GoldChain
      }
    ]
  },
  {
    path: '/chat/:id',
    name: 'ChatDetail',
    component: ChatDetail
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

import { AuthService } from '../services/auth'

// ... (routes stay same)

// Simple navigation guard
router.beforeEach((to, from, next) => {
  const isAuthenticated = AuthService.isAuthenticated()
  if (to.name !== 'Login' && to.name !== 'Register' && to.name !== 'ForgotPassword' && !isAuthenticated) {
    next({ name: 'Login' })
  } else {
    next()
  }
})

export default router
