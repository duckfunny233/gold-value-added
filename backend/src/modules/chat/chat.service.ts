import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

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
  type?: 'transfer'
  amount?: number
  recipientName?: string
  recipientUid?: string
  note?: string
  status?: string
  orderId?: string
  chatId?: number
  feeRate?: number
  netAmount?: number
  appreciationUsed?: number
  principalUsed?: number
  receiverFeeRate?: number
  receiverFeeAmount?: number
  receiverNetAmount?: number
}

type TransferTarget = {
  id: string
  uid: string
  nickname: string
  avatar: string
}

type GroupCandidate = TransferTarget & {
  role: string
}

type TransferTargetsQuery = {
  chatId?: number
  chatType?: 'user' | 'group' | 'system'
  chatTitle?: string
}

type SendTransferInput = {
  chatId: number
  recipientId?: string | number
  recipientUid?: string
  recipientName?: string
  amount: number
  note?: string
  chatType?: 'user' | 'group' | 'system'
}

type FriendProfile = {
  id: string
  uid: string
  nickname: string
  avatar: string
  intro: string
  city: string
  tags: string[]
  mutualFriends: number
  status: string
}

type FriendRequestInput = {
  targetUserId: string
  message?: string
}

type FriendRequestRecord = {
  requestId: string
  status: 'pending' | 'accepted'
  targetUserId: string
  message: string
  chatId?: number
  chatName?: string
  createdAt: Date
}

type CreateGroupInput = {
  name: string
  memberIds: string[]
  notice?: string
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

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

  private readonly friendDirectorySeed: FriendProfile[] = [
    {
      id: '101',
      uid: 'U0002101',
      nickname: '金市观察员',
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=gold-observer',
      intro: '擅长贵金属波段分析，常分享上金所盘面观察。',
      city: '上海',
      tags: ['黄金', '行情分析', 'AU9999'],
      mutualFriends: 3,
      status: '可添加',
    },
    {
      id: '102',
      uid: 'U0002102',
      nickname: '银链研究员',
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=silver-link',
      intro: '关注白银套利与跨市场机会。',
      city: '杭州',
      tags: ['白银', '套利', '短线'],
      mutualFriends: 1,
      status: '可添加',
    },
    {
      id: '103',
      uid: 'U0002103',
      nickname: '上金所数据台',
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=sgedata',
      intro: '同步上金所交易时间与盘口节奏。',
      city: '深圳',
      tags: ['上金所', '数据', '盘口'],
      mutualFriends: 5,
      status: '可添加',
    },
  ]

  private readonly groupCandidates: GroupCandidate[] = [
    {
      id: '201',
      uid: 'U0002201',
      nickname: '贵金属套利营',
      avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-1',
      role: '群成员',
    },
    {
      id: '202',
      uid: 'U0002202',
      nickname: '盘中快讯官',
      avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-2',
      role: '群成员',
    },
    {
      id: '203',
      uid: 'U0002203',
      nickname: '量化小队长',
      avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-3',
      role: '群成员',
    },
  ]

  private readonly friendRequests = new Map<string, FriendRequestRecord>()
  private readonly friendChatByTarget = new Map<string, number>()
  private friendRequestSeq = 1

  getChatList() {
    return this.chats
  }

  async parseScan(code: string) {
    const rawCode = String(code || '').trim()
    if (!rawCode) {
      throw new BadRequestException('二维码无效或格式不支持')
    }

    if (
      rawCode.startsWith('expired:') ||
      rawCode.startsWith('exp:') ||
      rawCode.includes('expired')
    ) {
      throw new GoneException('二维码已失效')
    }

    if (rawCode.startsWith('friend:')) {
      const target = rawCode.slice('friend:'.length).trim()
      const friend = await this.findFriendById(target)
      if (!friend) {
        throw new BadRequestException('二维码无效或格式不支持')
      }

      return {
        type: 'friend',
        targetId: friend.id,
        action: 'open-friend-profile',
        payload: {
          uid: friend.uid,
          nickname: friend.nickname,
        },
        title: '识别到好友二维码',
        description: `可查看 ${friend.nickname} 资料并发起好友申请`,
        actionLabel: '查看用户信息',
      }
    }

    if (rawCode.startsWith('group:')) {
      const target = rawCode.slice('group:'.length).trim()
      if (!target) {
        throw new BadRequestException('二维码无效或格式不支持')
      }

      const groupChat = this.chats.find(
        (item) => item.type === 'group' && String(item.id) === target,
      )
      return {
        type: 'group',
        targetId: Number(target) || target,
        action: 'open-group-chat',
        payload: {
          chatName: groupChat?.name || '群聊',
        },
        title: '识别到群聊二维码',
        description: `可加入“${groupChat?.name || '群聊'}”并直接进入群聊`,
        actionLabel: '加入并进入群聊',
      }
    }

    if (rawCode.startsWith('url:')) {
      const slug = rawCode.slice('url:'.length).trim()
      if (!slug) {
        throw new BadRequestException('二维码无效或格式不支持')
      }

      return {
        type: 'url',
        targetId: slug,
        action: 'open-activity',
        payload: {
          slug,
        },
        title: '识别到活动二维码',
        description: '已解析为官方活动链接，可在后续接入真实跳转。',
        actionLabel: '查看活动说明',
      }
    }

    throw new BadRequestException('二维码无效或格式不支持')
  }

  async searchFriends(keyword = '') {
    const directory = await this.loadFriendDirectory()
    const query = keyword.trim().toLowerCase()
    if (!query) {
      return directory
    }

    return directory.filter((item) => {
      const searchable = [
        item.uid,
        item.nickname,
        item.city,
        item.intro,
        ...item.tags,
      ]
      return searchable.some((part) => part.toLowerCase().includes(query))
    })
  }

  async getFriendProfile(id: string) {
    const friend = await this.findFriendById(id)
    if (!friend) {
      throw new NotFoundException('未找到相关用户')
    }
    return friend
  }

  async sendFriendRequest(input: FriendRequestInput) {
    const targetId = String(input.targetUserId || '').trim()
    if (!targetId) {
      throw new BadRequestException('targetUserId 不能为空')
    }

    const friend = await this.findFriendById(targetId)
    if (!friend) {
      throw new NotFoundException('未找到相关用户')
    }

    const duplicate = Array.from(this.friendRequests.values()).find(
      (item) => item.targetUserId === friend.id && item.status === 'pending',
    )
    if (duplicate) {
      throw new ConflictException('申请已发送，请勿重复操作')
    }

    const requestId = `fr_${Date.now()}_${this.friendRequestSeq++}`
    const request: FriendRequestRecord = {
      requestId,
      status: 'pending',
      targetUserId: friend.id,
      message: String(input.message || '你好，我想添加你为好友。').trim(),
      createdAt: new Date(),
    }
    this.friendRequests.set(requestId, request)

    return {
      requestId: request.requestId,
      status: request.status,
      targetUserId: request.targetUserId,
      message: request.message,
    }
  }

  async confirmFriendRequest(requestId: string) {
    const request = this.friendRequests.get(requestId)
    if (!request) {
      throw new NotFoundException('好友申请不存在')
    }

    if (request.status === 'accepted' && request.chatId) {
      return {
        requestId: request.requestId,
        status: request.status,
        chatId: request.chatId,
        chatName: request.chatName,
      }
    }

    const friend = await this.findFriendById(request.targetUserId)
    if (!friend) {
      throw new NotFoundException('未找到相关用户')
    }

    const existingChatId = this.friendChatByTarget.get(friend.id)
    let chat = existingChatId
      ? this.chats.find((item) => item.id === existingChatId)
      : undefined

    if (!chat) {
      chat =
        this.chats.find(
          (item) => item.type === 'user' && item.name === friend.nickname,
        ) || undefined
    }

    if (!chat) {
      const chatId = this.nextChatId()
      chat = {
        id: chatId,
        name: friend.nickname,
        lastMsg: '你们已成为好友，可以开始聊天。',
        time: this.formatTime(new Date()),
        type: 'user',
      }
      this.chats.unshift(chat)
      this.messages.set(chat.id, [
        {
          id: this.nextMessageId(chat.id),
          text: '你们已成为好友，可以开始聊天。',
          self: false,
          time: chat.time,
        },
      ])
    }

    this.friendChatByTarget.set(friend.id, chat.id)
    request.status = 'accepted'
    request.chatId = chat.id
    request.chatName = chat.name
    this.friendRequests.set(requestId, request)

    return {
      requestId: request.requestId,
      status: request.status,
      chatId: request.chatId,
      chatName: request.chatName,
    }
  }

  async getMyQrCode() {
    const user = await this.prisma.user.findFirst({
      where: {
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        paymentProfile: true,
      },
    })

    const uid = user?.uid || 'U0001001'
    const displayName = user?.paymentProfile?.displayName || user?.nickname || user?.username || '黄金投资者_888'
    const qrPayload =
      user?.paymentProfile?.qrPayload || `jinlian://pay?uid=${encodeURIComponent(uid)}&name=${encodeURIComponent(displayName)}`

    return {
      uid,
      displayName,
      qrPayload,
      slogan: '支付先扣增值后扣本金，收款方可能产生手续费',
      // 兼容前端现有字段
      nickname: displayName,
      qrCode: this.createQrDataUri(qrPayload, displayName),
      tips: ['扫码可添加我为好友', '支付时先扣增值后扣本金', '收款方可能产生手续费'],
    }
  }

  async getTransferTargets(query: TransferTargetsQuery) {
    const chatType = query.chatType || 'user'
    if (chatType === 'group') {
      return this.groupCandidates
    }

    if (chatType === 'system') {
      return []
    }

    const directory = await this.loadFriendDirectory()
    const title = String(query.chatTitle || '').trim()
    const exact = title
      ? directory.find((item) => item.nickname === title)
      : undefined

    const candidates = exact ? [exact] : directory.slice(0, 1)
    return candidates.map((item) => ({
      id: item.id,
      uid: item.uid,
      nickname: item.nickname,
      avatar: item.avatar,
    }))
  }

  async getGroupCandidates() {
    const directory = await this.loadFriendDirectory()
    const merged: GroupCandidate[] = [...this.groupCandidates]
    const existingIds = new Set(merged.map((item) => item.id))

    directory.slice(0, 10).forEach((item) => {
      if (existingIds.has(item.id)) {
        return
      }
      merged.push({
        id: item.id,
        uid: item.uid,
        nickname: item.nickname,
        avatar: item.avatar,
        role: '群成员',
      })
      existingIds.add(item.id)
    })

    return merged
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

  async sendTransfer(input: SendTransferInput) {
    const chat = this.chats.find((item) => item.id === Number(input.chatId))
    if (!chat) {
      throw new NotFoundException('会话不存在')
    }
    if (chat.type === 'system') {
      throw new BadRequestException('系统会话不支持转账')
    }

    const amount = Number(input.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('转账金额无效')
    }

    const recipient = await this.resolveTransferRecipient(input)
    if (!recipient) {
      throw new NotFoundException('未找到收款对象')
    }

    const receiverFeeRate = 0.001
    const receiverFeeAmount = this.calculateReceiverFee(amount)
    const netAmount = this.roundMoney(amount - receiverFeeAmount)
    const appreciationUsed = this.roundMoney(Math.min(amount, amount * 0.6))
    const principalUsed = this.roundMoney(amount - appreciationUsed)
    const now = new Date()

    const message: ChatMessage = {
      id: this.nextMessageId(chat.id),
      type: 'transfer',
      text: `转账 ¥${amount.toFixed(2)} 给 ${recipient.nickname}`,
      self: true,
      time: this.formatTime(now),
      amount: this.roundMoney(amount),
      recipientName: recipient.nickname,
      recipientUid: recipient.uid,
      note: String(input.note || '').trim(),
      status: 'completed',
      orderId: `pay_${now.getTime()}`,
      chatId: chat.id,
      feeRate: receiverFeeRate,
      netAmount,
      appreciationUsed,
      principalUsed,
      receiverFeeRate,
      receiverFeeAmount,
      receiverNetAmount: netAmount,
    }

    const chatMessages = this.messages.get(chat.id)
    if (!chatMessages) {
      this.messages.set(chat.id, [message])
    } else {
      chatMessages.push(message)
    }
    chat.lastMsg = `转账 ¥${amount.toFixed(2)} 给 ${recipient.nickname}`
    chat.time = message.time

    return message
  }

  async createGroup(input: CreateGroupInput) {
    const name = String(input.name || '').trim()
    const memberIds = Array.from(
      new Set(
        (Array.isArray(input.memberIds) ? input.memberIds : [])
          .map((item) => String(item || '').trim())
          .filter((item) => item.length > 0),
      ),
    )
    const notice = String(input.notice || '').trim()

    if (!name) {
      throw new BadRequestException('群名称不能为空')
    }
    if (memberIds.length < 2) {
      throw new BadRequestException('群成员至少 2 人')
    }

    const duplicated = this.chats.find(
      (item) =>
        item.type === 'group' && item.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicated) {
      throw new ConflictException('群聊创建失败，请稍后再试')
    }

    const chatId = this.nextChatId()
    const now = new Date()
    const createdSummary = `已创建群聊「${name}」，成员 ${memberIds.length} 人`
    const createdAt = this.formatTime(now)
    const groupId = `grp_${chatId}`

    this.chats.unshift({
      id: chatId,
      name,
      lastMsg: createdSummary,
      time: createdAt,
      type: 'group',
    })

    const firstMessage = notice
      ? `群公告：${notice}`
      : `群聊 ${name} 创建成功，欢迎交流。`
    this.messages.set(chatId, [
      {
        id: this.nextMessageId(chatId),
        text: firstMessage,
        self: false,
        time: createdAt,
      },
    ])

    return {
      groupId,
      chatId,
      name,
      memberCount: memberIds.length,
      status: 'created',
    }
  }

  private formatTime(date: Date) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  private nextChatId() {
    return this.chats.length
      ? Math.max(...this.chats.map((item) => item.id)) + 1
      : 1
  }

  private nextMessageId(chatId: number) {
    const messages = this.messages.get(chatId) || []
    return (messages.at(-1)?.id || chatId * 1000) + 1
  }

  private roundMoney(value: number) {
    return Number(value.toFixed(2))
  }

  private calculateReceiverFee(amount: number) {
    if (amount <= 100) {
      return 0
    }
    return this.roundMoney(amount * 0.001)
  }

  private async resolveTransferRecipient(
    input: SendTransferInput,
  ): Promise<TransferTarget | null> {
    const candidates = await this.getTransferTargets({
      chatId: input.chatId,
      chatType: input.chatType,
      chatTitle: input.recipientName,
    })

    const recipientId = input.recipientId ? String(input.recipientId) : ''
    const recipientUid = String(input.recipientUid || '').trim()
    const recipientName = String(input.recipientName || '').trim()

    const matched =
      candidates.find((item) => item.id === recipientId) ||
      candidates.find((item) => item.uid === recipientUid) ||
      candidates.find((item) => item.nickname === recipientName)

    if (matched) {
      return matched
    }

    if (recipientName) {
      return {
        id: recipientId || `temp_${Date.now()}`,
        uid: recipientUid || `U${Date.now()}`,
        nickname: recipientName,
        avatar:
          'https://api.dicebear.com/7.x/adventurer/svg?seed=transfer-recipient',
      }
    }

    return null
  }

  private async findFriendById(id: string) {
    const normalized = String(id || '').trim()
    if (!normalized) {
      return null
    }

    const directory = await this.loadFriendDirectory()
    return (
      directory.find((item) => item.id === normalized) ||
      directory.find((item) => item.uid === normalized) ||
      null
    )
  }

  private async loadFriendDirectory() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        id: true,
        uid: true,
        username: true,
        nickname: true,
        createdAt: true,
      },
    })

    const mappedUsers: FriendProfile[] = users.map((user, index) => {
      const nickname = user.nickname || user.username || user.uid
      const hash = this.hashCode(user.uid || user.id)
      const cities = ['上海', '杭州', '深圳', '北京', '广州', '成都']
      const tags = ['黄金', '白银', 'AU9999', '交易', '行情']
      return {
        id: user.id,
        uid: user.uid,
        nickname,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.uid)}`,
        intro: '关注贵金属行情，欢迎交流交易经验。',
        city: cities[hash % cities.length],
        tags: [tags[hash % tags.length], tags[(hash + 2) % tags.length]],
        mutualFriends: (index % 6) + 1,
        status: '可添加',
      }
    })

    const merged = [...this.friendDirectorySeed]
    const existingIds = new Set(merged.map((item) => item.id))
    mappedUsers.forEach((item) => {
      if (!existingIds.has(item.id)) {
        merged.push(item)
      }
    })

    return merged
  }

  private hashCode(input: string) {
    let hash = 0
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }

  private createQrDataUri(payload: string, label: string) {
    const safePayload = this.escapeXml(payload).slice(0, 40)
    const safeLabel = this.escapeXml(label).slice(0, 24)
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
        <rect width="240" height="240" rx="20" fill="#ffffff"/>
        <g fill="#0f172a">
          <rect x="22" y="22" width="54" height="54" rx="4"/>
          <rect x="34" y="34" width="30" height="30" rx="2" fill="#ffffff"/>
          <rect x="164" y="22" width="54" height="54" rx="4"/>
          <rect x="176" y="34" width="30" height="30" rx="2" fill="#ffffff"/>
          <rect x="22" y="164" width="54" height="54" rx="4"/>
          <rect x="34" y="176" width="30" height="30" rx="2" fill="#ffffff"/>
          <rect x="98" y="24" width="12" height="12"/>
          <rect x="122" y="24" width="12" height="12"/>
          <rect x="98" y="48" width="12" height="12"/>
          <rect x="122" y="48" width="12" height="12"/>
          <rect x="98" y="72" width="12" height="12"/>
          <rect x="110" y="84" width="12" height="12"/>
          <rect x="134" y="84" width="12" height="12"/>
          <rect x="86" y="108" width="12" height="12"/>
          <rect x="110" y="108" width="12" height="12"/>
          <rect x="134" y="108" width="12" height="12"/>
          <rect x="158" y="108" width="12" height="12"/>
          <rect x="86" y="132" width="12" height="12"/>
          <rect x="110" y="132" width="12" height="12"/>
          <rect x="146" y="132" width="12" height="12"/>
          <rect x="170" y="132" width="12" height="12"/>
          <rect x="86" y="156" width="12" height="12"/>
          <rect x="122" y="156" width="12" height="12"/>
          <rect x="146" y="156" width="12" height="12"/>
          <rect x="170" y="156" width="12" height="12"/>
          <rect x="98" y="180" width="12" height="12"/>
          <rect x="122" y="180" width="12" height="12"/>
          <rect x="146" y="180" width="12" height="12"/>
          <rect x="170" y="180" width="12" height="12"/>
        </g>
        <text x="120" y="216" text-anchor="middle" font-size="12" fill="#64748b" font-family="Arial, sans-serif">${safeLabel}</text>
        <text x="120" y="230" text-anchor="middle" font-size="10" fill="#94a3b8" font-family="Arial, sans-serif">${safePayload}</text>
      </svg>
    `
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  }

  private escapeXml(input: string) {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}
