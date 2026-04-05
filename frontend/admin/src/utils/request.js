export const API_BASE = 'http://localhost:3000'

export async function apiFetch(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
  const response = await fetch(fullUrl, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await response.json()
  if (!response.ok || data.code !== 200) {
    throw new Error(data.message || `请求失败 (${response.status})`)
  }

  return data.data
}
