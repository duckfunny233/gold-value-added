import { apiFetch } from '../utils/request'
import i18n from '../i18n'
import { cloneChatMock } from './chat-mock'

const wrapData = (data) => ({ code: 200, data: cloneChatMock(data) })
const tt = (key, params = {}) => i18n.global.t(key, params)
const localizeTime = (item) => {
  if (item?.timeKey) return tt(item.timeKey)
  if (item?.time === '昨天' || String(item?.time || '').toLowerCase() === 'yesterday') return tt('chat.timeYesterday')
  if (item?.time === '刚刚' || String(item?.time || '').toLowerCase() === 'just now') return tt('chat.timeJustNow')
  return item?.time || ''
}
const localizeChatItem = (item) => ({
  ...item,
  name: item?.nameKey ? tt(item.nameKey) : item?.name,
  lastMsg: item?.lastMsgKey ? tt(item.lastMsgKey) : item?.lastMsg,
  time: localizeTime(item),
})
const localizeMessage = (item) => ({
  ...item,
  text: item?.textKey ? tt(item.textKey) : item?.text,
  time: localizeTime(item),
})
const normalizeQrPayload = (item) => ({
  ...item,
  displayName: item?.displayName || item?.nickname || 'GoldInvestor_888',
  slogan:
    item?.slogan ||
    '支付先扣增值后扣本金，收款方可能产生手续费',
  qrPayload: item?.qrPayload || '',
})

export const ChatService = {
  async getChatList() {
    const response = await apiFetch('/api/chat/list')
    const list = Array.isArray(response?.data) ? response.data : []
    return wrapData(list.map(localizeChatItem))
  },

  async getMessages(chatId, page = 1, limit = 20) {
    const response = await apiFetch(`/api/chat/messages/${chatId}?page=${page}&limit=${limit}`)
    const mergedItems = (Array.isArray(response?.data?.items) ? response.data.items : []).map(localizeMessage)
    return wrapData({
      ...response.data,
      items: mergedItems,
      total: Math.max(Number(response.data?.total || 0), mergedItems.length),
    })
  },

  sendMessage(chatId, text) {
    return apiFetch('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify({ chatId, text })
    })
  },

  searchFriends(keyword = '') {
    return apiFetch(`/api/chat/friend-search?keyword=${encodeURIComponent(keyword)}`)
  },

  getFriendProfile(id) {
    return apiFetch(`/api/chat/friend-profile/${id}`)
  },

  sendFriendRequest(payload) {
    return apiFetch('/api/chat/friend-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  confirmFriendRequest(requestId) {
    return apiFetch(`/api/chat/friend-request/${requestId}/confirm`, {
      method: 'POST',
    })
  },

  getGroupCandidates() {
    return apiFetch('/api/chat/group-candidates')
  },

  createGroup(payload) {
    return apiFetch('/api/chat/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  parseScan(code) {
    return apiFetch('/api/chat/scan/parse', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },

  getMyQrCode() {
    return apiFetch('/api/chat/my-qr').then((response) => {
      return wrapData(normalizeQrPayload(response?.data || {}))
    })
  },

  getTransferTargets(chatId, chatType = 'user', chatTitle = '') {
    return apiFetch(`/api/chat/transfer-targets?chatId=${encodeURIComponent(chatId)}&chatType=${encodeURIComponent(chatType)}&chatTitle=${encodeURIComponent(chatTitle)}`)
  },

  sendTransfer(chatId, payload) {
    return apiFetch('/api/chat/transfer', {
      method: 'POST',
      body: JSON.stringify({ chatId, ...payload }),
    })
  },
}
