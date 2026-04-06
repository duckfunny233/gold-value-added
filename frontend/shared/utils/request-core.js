export const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE || 'http://localhost:3001'

export function createApiFetch(config = {}) {
  const {
    apiBase = DEFAULT_API_BASE,
    unwrapData = false,
    getToken,
    onUnauthorized,
    onBusinessError,
    onNetworkError,
  } = config

  return async function apiFetch(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }

    const token = getToken ? getToken() : ''
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
      })

      if (response.status === 401) {
        const message = '登录状态已失效'
        if (onUnauthorized) {
          onUnauthorized(message)
        }
        throw new Error(message)
      }

      const text = await response.text()
      let payload = {}

      try {
        payload = text ? JSON.parse(text) : {}
      } catch (error) {
        throw new Error(`接口返回了非 JSON 内容: ${url}`)
      }

      if (!response.ok || (payload.code && payload.code !== 200)) {
        const message = payload.message || `请求失败 (${response.status})`
        if (onBusinessError) {
          onBusinessError(message, payload)
        }
        throw new Error(message)
      }

      return unwrapData ? payload.data : payload
    } catch (error) {
      if (onNetworkError) {
        onNetworkError(error)
      }
      throw error
    }
  }
}
