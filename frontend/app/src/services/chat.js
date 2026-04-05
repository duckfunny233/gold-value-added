import { apiFetch } from '../utils/request'

export const ChatService = {
  getChatList() {
    return apiFetch('/api/chat/list')
  },

  getMessages(chatId, page = 1, limit = 20) {
    return apiFetch(`/api/chat/messages/${chatId}?page=${page}&limit=${limit}`)
  },

  sendMessage(chatId, text) {
    return apiFetch('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify({ chatId, text })
    })
  }
}