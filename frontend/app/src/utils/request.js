import { showToast } from '../composables/useToast'
import { getCurrentInstance } from 'vue'
import { createApiFetch, DEFAULT_API_BASE } from '../../../shared/utils/request-core'

// 鑷姩妫€娴嬪钩鍙?
const isAndroid = /Android/i.test(navigator.userAgent)
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
const isMobile = isAndroid || isIOS

// 缁熶竴浣跨敤 API 鍩虹璺緞 (寤鸿鍚庣画浣跨敤 .env 鍙橀噺)
//  export const API_BASE = 'http://202.182.125.24:33603'
export const API_BASE = DEFAULT_API_BASE

const getT = () => {
  try {
    const instance = getCurrentInstance()
    if (instance && instance.appContext.config.globalProperties.$t) {
      return instance.appContext.config.globalProperties.$t
    }
  } catch (e) {}
  return (key) => key
}

export const apiFetch = createApiFetch({
  apiBase: API_BASE,
  getToken: () => localStorage.getItem('token'),
  onUnauthorized: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('isAuthenticated')
    const t = getT()
    showToast(t('errors.sessionExpired'))
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  },
  onBusinessError: (message) => {
    showToast(message)
  },
  onNetworkError: (error) => {
    console.error('[API Error]', error.message)
    const t = getT()
    const canFallbackSilently = error.message.includes('Failed to fetch')
      || error.message.includes('接口返回了非 JSON 内容')
      || error.message.includes('Cannot GET /api/')
    if (!canFallbackSilently && !error.message.includes('请求失败') && !error.message.includes('失效')) {
      showToast(error.message || t('errors.networkError'))
    }
  },
})
