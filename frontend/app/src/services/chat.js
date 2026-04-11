import { apiFetch } from '../utils/request'
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
  getChatList() {
    return withFallback(() => apiFetch('/api/chat/list'), localChatList)
  },

  async getMessages(chatId, page = 1, limit = 20) {
    try {
      const response = await apiFetch(`/api/chat/messages/${chatId}?page=${page}&limit=${limit}`)
      const mergedItems = getMergedMessages(chatId, response.data?.items || [])
      return wrapData({
        ...response.data,
        items: mergedItems,
        total: Math.max(Number(response.data?.total || 0), mergedItems.length),
      })
    } catch (error) {
      const items = getMergedMessages(chatId, localChatMessages[chatId] || [])
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
          message: payload.message || '你好，我想添加你为好友',
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
          const chatName = friend?.nickname || '新好友'
          let chat = localChatList.find((item) => item.name === chatName)
          if (!chat) {
            const chatId = nextLocalChatId()
            chat = {
              id: chatId,
              name: chatName,
              lastMsg: '我们已经成为好友，开始聊天吧',
              time: '刚刚',
              type: 'user',
            }
            localChatList.unshift(chat)
            localChatMessages[chatId] = [
              { id: Date.now(), text: '我们已经成为好友，开始聊天吧', self: false, time: currentTimeLabel() },
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
          name: payload.name || '新建群聊',
          lastMsg: `${payload.memberIds?.length || 0} 位成员已加入群聊`,
          time: '刚刚',
          type: 'group',
        })
        localChatMessages[chatId] = [
          {
            id: Date.now(),
            text: `群聊创建成功：${payload.name || '新建群聊'}${payload.notice ? `，群公告：${payload.notice}` : ''}`,
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
          chat.lastMsg = `转账 ¥${Number(payload.amount).toFixed(2)} 给 ${payload.recipientName}`
          chat.time = message.time
        }
        return message
      }
    )
  },
}
