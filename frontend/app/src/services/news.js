import { apiFetch } from '../utils/request'

export const NewsService = {
  getNews(page = 1, limit = 10) {
    return apiFetch(`/api/news?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`, {
      method: 'GET',
    })
  },

  getNewsDetail(id) {
    return apiFetch(`/api/news/${id}`, {
      method: 'GET',
    })
  }
}
