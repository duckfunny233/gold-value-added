import { showToast } from '../composables/useToast'
import { getCurrentInstance } from 'vue'

// 鑷姩妫€娴嬪钩鍙?
const isAndroid = /Android/i.test(navigator.userAgent)
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
const isMobile = isAndroid || isIOS

// 缁熶竴浣跨敤 API 鍩虹璺緞 (寤鸿鍚庣画浣跨敤 .env 鍙橀噺)
//  export const API_BASE = 'http://202.182.125.24:33603'
export const API_BASE = 'http://localhost:3000'

const getT = () => {
  try {
    const instance = getCurrentInstance()
    if (instance && instance.appContext.config.globalProperties.$t) {
      return instance.appContext.config.globalProperties.$t
    }
  } catch (e) {}
  return (key) => key
}

/**
 * 鏍稿績璇锋眰鏂规硶
 */
export async function apiFetch(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
  
  // 1. 鑷姩娉ㄥ叆璇锋眰澶?
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // 2. 鑷姩娉ㄥ叆 Token
  const token = localStorage.getItem('token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const fetchOptions = {
    ...options,
    headers,
  }

  try {
    const response = await fetch(fullUrl, fetchOptions)
    
    // 3. 鍏ㄥ眬鍝嶅簲鎷︽埅
    if (response.status === 401) {
      // Token 杩囨湡鎴栨湭鐧诲綍
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('isAuthenticated')
      const t = getT()
      const expiredMsg = t('errors.sessionExpired')
      showToast(expiredMsg)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      throw new Error(expiredMsg)
    }

    const data = await response.json()

    // 4. 涓氬姟閫昏緫閿欒澶勭悊
    if (!response.ok || (data.code && data.code !== 200)) {
      const errorMsg = data.message || `璇锋眰澶辫触 (${response.status})`
      showToast(errorMsg)
      throw new Error(errorMsg)
    }

    return data
  } catch (error) {
    console.error(`[API Error] ${url}:`, error.message)
    // 鍙湁闈炰笟鍔″紓甯告墠寮圭綉缁滄彁绀?
    if (!error.message.includes('澶辫触') && !error.message.includes('杩囨湡')) {
      const t = getT()
      showToast(error.message || t('errors.networkError'))
    }
    throw error // 鎶涚粰璋冪敤鏂瑰鐞?
  }
}
