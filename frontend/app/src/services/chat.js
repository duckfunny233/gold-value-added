import { apiFetch } from '../utils/request'
import i18n from '../i18n'
import {
  buildFriendSearchResult,
  chatListMock,
  chatMessagesMock,
  buildScanResult,
  buildTransferMessage,
  buildTransferTargets,
  cloneChatMock,
  friendDirectoryMock,
  groupCandidatesMock,
  myQrMock,
} from './chat-mock'

const wrapData = (data) => ({ code: 200, data: cloneChatMock(data) })
const localChatList = cloneChatMock(chatListMock)
const localChatMessages = cloneChatMock(chatMessagesMock)
const localFriendRequests = new Map()
const localInjectedMessages = {}
const nextLocalChatId = () => (localChatList.length ? Math.max(...localChatList.map((item) => Number(item.id) || 0)) + 1 : 1)
const currentTimeLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
const getMergedMessages = (chatId, items = []) => {
  const serverItems = Array.isArray(items) ? items : []
  const injectedItems = localInjectedMessages[chatId] || []
  const seenIds = new Set(serverItems.map((item) => item.id))
  return [...serverItems, ...injectedItems.filter((item) => !seenIds.has(item.id))]
}
const appendInjectedMessage = (chatId, message) => {
  localInjectedMessages[chatId] = [...(localInjectedMessages[chatId] || []), message]
}

const withFallback = async (request, fallback) => {
  try {
    return await request()
  } catch (error) {
    return wrapData(typeof fallback === 'function' ? fallback() : fallback)
  }
}

export const ChatService = {
  async getChatList() {
    try {
      const response = await apiFetch('/api/chat/list')
      const list = Array.isArray(response?.data) ? response.data : []
      return wrapData(list.map(localizeChatItem))
    } catch (error) {
      return wrapData(localChatList.map(localizeChatItem))
    }
  },

  async getMessages(chatId, page = 1, limit = 20) {
    try {
      const response = await apiFetch(`/api/chat/messages/${chatId}?page=${page}&limit=${limit}`)
      const mergedItems = getMergedMessages(chatId, response.data?.items || []).map(localizeMessage)
      return wrapData({
        ...response.data,
        items: mergedItems,
        total: Math.max(Number(response.data?.total || 0), mergedItems.length),
      })
    } catch (error) {
      const items = getMergedMessages(chatId, localChatMessages[chatId] || []).map(localizeMessage)
      return wrapData({
        items,
        total: items.length,
        hasMore: false,
      })
    }
  },

  sendMessage(chatId, text) {
    return withFallback(
      () => apiFetch('/api/chat/send', {
        method: 'POST',
        body: JSON.stringify({ chatId, text })
      }),
      () => {
        const message = {
          id: Date.now(),
          text,
          self: true,
          time: currentTimeLabel(),
        }
        localChatMessages[chatId] = [...(localChatMessages[chatId] || []), message]
        appendInjectedMessage(chatId, message)
        const chat = localChatList.find((item) => String(item.id) === String(chatId))
        if (chat) {
          chat.lastMsg = text
          chat.time = message.time
        }
        return message
      }
    )
  },

  searchFriends(keyword = '') {
    return withFallback(
      () => apiFetch(`/api/chat/friend-search?keyword=${encodeURIComponent(keyword)}`),
      () => buildFriendSearchResult(keyword)
    )
  },

  getFriendProfile(id) {
    return withFallback(
      () => apiFetch(`/api/chat/friend-profile/${id}`),
      () => friendDirectoryMock.find((item) => String(item.id) === String(id)) || friendDirectoryMock[0]
    )
  },

  sendFriendRequest(payload) {
    return withFallback(
      () => apiFetch('/api/chat/friend-request', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      () => {
        const request = {
          requestId: `fr_${Date.now()}`,
          status: 'pending',
          targetUserId: payload.targetUserId,
          message: payload.message || tt('chat.addFriendPage.requestMessage'),
        }
        localFriendRequests.set(request.requestId, request)
        return request
      }
    )
  },

  confirmFriendRequest(requestId) {
    return withFallback(
      () => apiFetch(`/api/chat/friend-request/${requestId}/confirm`, {
        method: 'POST',
      }),
      () => ({
        requestId,
        status: 'accepted',
        ...(() => {
          const request = localFriendRequests.get(requestId)
          const friend = friendDirectoryMock.find((item) => String(item.id) === String(request?.targetUserId)) || friendDirectoryMock[0]
          const chatName = friend?.nickname || tt('chat.addFriendPage.newFriend')
          let chat = localChatList.find((item) => item.name === chatName)
          if (!chat) {
            const chatId = nextLocalChatId()
            chat = {
              id: chatId,
              name: chatName,
              lastMsg: tt('chat.message.friend.connected'),
              time: tt('chat.timeJustNow'),
              type: 'user',
            }
            localChatList.unshift(chat)
            localChatMessages[chatId] = [
              { id: Date.now(), text: tt('chat.message.friend.connected'), self: false, time: currentTimeLabel() },
            ]
          }
          return {
            chatId: chat.id,
            chatName: chat.name,
          }
        })(),
      })
    )
  },

  getGroupCandidates() {
    return withFallback(() => apiFetch('/api/chat/group-candidates'), groupCandidatesMock)
  },

  createGroup(payload) {
    return withFallback(
      () => apiFetch('/api/chat/groups', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      () => {
        const chatId = nextLocalChatId()
        localChatList.unshift({
          id: chatId,
          name: payload.name || tt('chat.createGroupPage.newGroup'),
          lastMsg: tt('chat.createGroupPage.createdDesc', { name: payload.name || tt('chat.createGroupPage.newGroup'), count: payload.memberIds?.length || 0 }),
          time: tt('chat.timeJustNow'),
          type: 'group',
        })
        localChatMessages[chatId] = [
          {
            id: Date.now(),
            text: tt('chat.message.group.created', { name: payload.name || tt('chat.createGroupPage.newGroup') }) + `${payload.notice ? ` ${tt('chat.createGroupPage.notice')}: ${payload.notice}` : ''}`,
            self: false,
            time: currentTimeLabel(),
          },
        ]
        return {
          groupId: `grp_${chatId}`,
          chatId,
          name: payload.name,
          memberCount: payload.memberIds?.length || 0,
          status: 'created',
        }
      }
    )
  },

  parseScan(code) {
    return withFallback(
      () => apiFetch('/api/chat/scan/parse', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
      () => buildScanResult(code)
    )
  },

  getMyQrCode() {
    return withFallback(() => apiFetch('/api/chat/my-qr'), myQrMock)
  },

  getTransferTargets(chatId, chatType = 'user', chatTitle = '') {
    return withFallback(
      () => apiFetch(`/api/chat/transfer-targets?chatId=${encodeURIComponent(chatId)}&chatType=${encodeURIComponent(chatType)}&chatTitle=${encodeURIComponent(chatTitle)}`),
      () => buildTransferTargets({ chatId, chatType, chatTitle })
    )
  },

  sendTransfer(chatId, payload) {
    return withFallback(
      () => apiFetch('/api/chat/transfer', {
        method: 'POST',
        body: JSON.stringify({ chatId, ...payload }),
      }),
      () => {
        const message = buildTransferMessage(payload)
        localChatMessages[chatId] = [...(localChatMessages[chatId] || []), message]
        appendInjectedMessage(chatId, message)
        const chat = localChatList.find((item) => String(item.id) === String(chatId))
        if (chat) {
          chat.lastMsg = tt('chat.message.transfer.summary', { amount: Number(payload.amount).toFixed(2), name: payload.recipientName })
          chat.time = message.time
        }
        return message
      }
    )
  },
}
