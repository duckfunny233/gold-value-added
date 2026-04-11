import { Injectable, NotFoundException } from '@nestjs/common'

type ChatSummary = {
  id: number
  name: string
  lastMsg: string
  time: string
  type: 'system' | 'user' | 'group'
}

type ChatMessage = {
  id: number
  text: string
  self: boolean
  time: string
}

@Injectable()
export class ChatService {
  private readonly chats: ChatSummary[] = [
    { id: 1, name: '系统消息', lastMsg: '您的账户实名认证已通过', time: '10:30', type: 'system' },
    { id: 2, name: '客服专员', lastMsg: '您好，请问有什么可以帮您的？', time: '09:15', type: 'user' },
    { id: 3, name: '全球黄金交流群', lastMsg: '张三: 今天的金价涨势不错', time: '昨天', type: 'group' },
  ]

  private readonly messages = new Map<number, ChatMessage[]>([
    [
      1,
      [
        { id: 1001, text: '欢迎来到金影子平台。', self: false, time: '09:58' },
        { id: 1002, text: '您的账户实名认证已通过。', self: false, time: '10:30' },
      ],
    ],
    [
      2,
      [
        { id: 2001, text: '您好，请问有什么可以帮您的？', self: false, time: '09:15' },
        { id: 2002, text: '我想了解一下提现时间。', self: true, time: '09:16' },
        { id: 2003, text: '工作日提交后会进入审核流程，请以页面进度为准。', self: false, time: '09:18' },
      ],
    ],
    [
      3,
      [
        { id: 3001, text: '今天黄金波动有点大。', self: false, time: '08:42' },
        { id: 3002, text: '我刚看了下，克价还在往上走。', self: false, time: '08:45' },
        { id: 3003, text: '等回踩再考虑加一点。', self: true, time: '08:47' },
      ],
    ],
  ])

  getChatList() {
    return this.chats
  }

  getMessages(chatId: number, page = 1, limit = 20) {
    const chatMessages = this.messages.get(chatId)
    if (!chatMessages) {
      throw new NotFoundException('会话不存在')
    }

    const total = chatMessages.length
    const start = Math.max(0, total - page * limit)
    const end = Math.max(0, total - (page - 1) * limit)
    const items = end > 0 ? chatMessages.slice(start, end) : []

    return {
      items,
      total,
      hasMore: start > 0,
    }
  }

  sendMessage(chatId: number, text: string) {
    const chatMessages = this.messages.get(chatId)
    const chat = this.chats.find((item) => item.id === chatId)

    if (!chatMessages || !chat) {
      throw new NotFoundException('会话不存在')
    }

    const trimmedText = text.trim()
    const message: ChatMessage = {
      id: (chatMessages.at(-1)?.id || chatId * 1000) + 1,
      text: trimmedText,
      self: true,
      time: this.formatTime(new Date()),
    }

    chatMessages.push(message)
    chat.lastMsg = trimmedText
    chat.time = message.time

    return message
  }

  private formatTime(date: Date) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }
}
