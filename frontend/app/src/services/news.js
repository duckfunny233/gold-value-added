import { API_BASE } from '../utils/request'
import { buildNewsDetailFallback, cloneData, newsListFallback } from './fallback-data'

const fetchJsonOrFallback = async (path, fallbackData) => {
  try {
    const response = await fetch(`${API_BASE}${path}`)
    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}
    if (!response.ok) {
      throw new Error(payload.message || 'request-failed')
    }
    return payload
  } catch (error) {
    return {
      code: 200,
      data: cloneData(typeof fallbackData === 'function' ? fallbackData() : fallbackData),
    }
  }
}

export const NewsService = {
  getNews(page = 1, limit = 10) {
    return fetchJsonOrFallback(`/api/news?page=${page}&limit=${limit}`, {
      items: newsListFallback.slice((page - 1) * limit, page * limit),
      total: newsListFallback.length,
      page,
      limit,
      totalPages: Math.ceil(newsListFallback.length / limit),
    })
  },

  getNewsDetail(id) {
    return fetchJsonOrFallback(`/api/news/${id}`, () => buildNewsDetailFallback(id))
  }
}
