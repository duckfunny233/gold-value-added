import { apiFetch } from '../utils/request'

export const NewsService = {
  getNews(page = 1, limit = 10) {
    return apiFetch(`/api/news?page=${page}&limit=${limit}`)
  },

  getNewsDetail(id) {
    return apiFetch(`/api/news/${id}`)
  }
}