import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ChatConversationType, ChatGroupRole, ChatMessageType, FriendRequestStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

type ChatSummary = {
  id: number
  name: string
  lastMsg: string
  time: string
  type: 'system' | 'user' | 'group'
  avatar?: string
  unreadCount?: number
}

type ChatMessage = {
  id: number
  text: string
  self: boolean
  time: string
  senderNickname?: string
  senderAvatar?: string
  type?: 'transfer' | 'friend_request' | 'system_notice'
  requestId?: string
  requestStatus?: 'pending' | 'accepted' | 'rejected'
  requestMessage?: string
  rejectNote?: string
  targetNickname?: string
  targetUid?: string
  requestDirection?: 'inbound' | 'outbound'
}

type TransferTargetsQuery = {
  chatId?: number
  chatType?: 'user' | 'group' | 'system'
  chatTitle?: string
}

type SendTransferInput = {
  chatId: number
  username?: string
  recipientId?: string | number
  recipientUid?: string
  recipientName?: string
  amount: number
  note?: string
  chatType?: 'user' | 'group' | 'system'
}

type FriendRequestInput = {
  targetUserId: string
  message?: string
}

type CreateGroupInput = {
  name: string
  memberIds: string[]
  notice?: string
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private formatTime(date: Date) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  private async requireUser(username?: string) {
    const normalized = String(username || '').trim()
    if (!normalized) throw new BadRequestException('缺少当前登录用户')
    const user = await this.prisma.user.findUnique({ where: { username: normalized } })
    if (!user) throw new NotFoundException('当前用户不存在')
    return user
  }

  private async ensureDefaultConversations(userId: string) {
    const defaults = [
      {
        type: ChatConversationType.SYSTEM,
        name: '系统消息',
        seed: ['欢迎来到金影子平台。', '您的账户实名认证已通过。'],
      },
      {
        type: ChatConversationType.SERVICE,
        name: '客服专员',
        seed: ['您好，请问有什么可以帮您的？', '工作日提交后会进入审核流程，请以页面进度为准。'],
      },
    ] as const

    for (const item of defaults) {
      let participant = await this.prisma.chatParticipant.findFirst({
        where: { userId, conversation: { type: item.type } },
        include: { conversation: true },
      })
      if (!participant) {
        const created = await this.prisma.chatConversation.create({
          data: {
            type: item.type,
            name: item.name,
            participants: { create: [{ userId, unreadCount: 0, groupRole: ChatGroupRole.MEMBER }] },
          },
        })
        for (const content of item.seed) {
          await this.prisma.chatMessage.create({
            data: {
              conversationId: created.id,
              type: ChatMessageType.TEXT,
              content,
            },
          })
        }
        participant = await this.prisma.chatParticipant.findFirst({
          where: { userId, conversationId: created.id },
          include: { conversation: true },
        })
      }
    }
  }

  async getChatList(username?: string) {
    const user = await this.requireUser(username)
    await this.ensureDefaultConversations(user.id)

    const participants = await this.prisma.chatParticipant.findMany({
      where: { userId: user.id, conversation: { dissolvedAt: null } },
      include: {
        conversation: {
          include: {
            participants: { include: { user: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const list: ChatSummary[] = participants.map((p) => {
      const conv = p.conversation
      const last = conv.messages[0]
      const other = conv.participants.find((x) => x.userId !== user.id)?.user
      const type =
        conv.type === ChatConversationType.SYSTEM
          ? 'system'
          : conv.type === ChatConversationType.GROUP
            ? 'group'
            : 'user'
      const name = conv.type === ChatConversationType.DIRECT ? (other?.username || conv.name || '用户') : (conv.name || '会话')
      return {
        id: conv.id,
        name,
        lastMsg: last?.content || '',
        time: last ? this.formatTime(last.createdAt) : '',
        type,
        avatar:
          conv.type === ChatConversationType.GROUP
            ? String(conv.avatarUrl || '')
            : conv.type === ChatConversationType.DIRECT && other?.uid
              ? `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(other.uid)}`
              : '',
        unreadCount: p.unreadCount,
      }
    })

    return list
  }

  async getMessages(chatId: number, page = 1, limit = 20, username?: string) {
    const user = await this.requireUser(username)
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!participant) throw new NotFoundException('会话不存在')
    if (participant.conversation.dissolvedAt) throw new NotFoundException('会话不存在')

    const total = await this.prisma.chatMessage.count({ where: { conversationId: chatId } })
    const skip = Math.max(0, total - page * limit)
    const take = Math.min(limit, Math.max(total - skip - (page - 1) * limit, 0)) || limit

    const rows = await this.prisma.chatMessage.findMany({
      where: {
        conversationId: chatId,
        ...(participant.clearedAt ? { createdAt: { gt: participant.clearedAt } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
      include: { sender: true },
    })

    const isGroupConversation = participant.conversation.type === ChatConversationType.GROUP
    const items: ChatMessage[] = rows.map((row) => {
      const metadata = (row.metadata || {}) as Record<string, unknown>
      const self = row.senderId === user.id
      const senderNickname = String(metadata.senderNickname || row.sender?.username || '')
      const senderAvatar = String(
        metadata.senderAvatar ||
          (row.sender?.uid
            ? `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(row.sender.uid)}`
            : ''),
      )
      if (row.type === ChatMessageType.FRIEND_REQUEST) {
        return {
          id: row.id,
          text: row.content,
          self,
          time: this.formatTime(row.createdAt),
          type: 'friend_request',
          requestId: String(metadata.requestId || ''),
          requestStatus: String(metadata.requestStatus || 'pending') as 'pending' | 'accepted' | 'rejected',
          requestMessage: String(metadata.requestMessage || ''),
          rejectNote: String(metadata.rejectNote || ''),
          targetNickname: String(metadata.targetNickname || ''),
          targetUid: String(metadata.targetUid || ''),
          requestDirection: String(metadata.requestDirection || 'inbound') as 'inbound' | 'outbound',
        }
      }
      if (row.type === ChatMessageType.SYSTEM_NOTICE) {
        return { id: row.id, text: row.content, self, time: this.formatTime(row.createdAt), type: 'system_notice' }
      }
      if (row.type === ChatMessageType.TRANSFER) {
        return {
          id: row.id,
          text: row.content,
          self,
          time: this.formatTime(row.createdAt),
          type: 'transfer',
          amount: Number(metadata.amount || 0),
          recipientName: String(metadata.recipientName || ''),
          recipientUid: String(metadata.recipientUid || ''),
          note: String(metadata.note || ''),
          status: String(metadata.status || 'completed'),
          orderId: String(metadata.orderId || ''),
          chatId,
          feeRate: Number(metadata.feeRate || 0),
          netAmount: Number(metadata.netAmount || 0),
          appreciationUsed: Number(metadata.appreciationUsed || 0),
          principalUsed: Number(metadata.principalUsed || 0),
          receiverFeeRate: Number(metadata.receiverFeeRate || 0),
          receiverFeeAmount: Number(metadata.receiverFeeAmount || 0),
          receiverNetAmount: Number(metadata.receiverNetAmount || 0),
        } as ChatMessage
      }
      return {
        id: row.id,
        text: row.content,
        self,
        time: this.formatTime(row.createdAt),
        ...(isGroupConversation ? { senderNickname, senderAvatar } : {}),
      }
    })

    return {
      items,
      total,
      hasMore: skip > 0,
    }
  }

  async markChatRead(chatId: number, username?: string) {
    const user = await this.requireUser(username)
    await this.prisma.chatParticipant.update({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      data: { unreadCount: 0 },
    })
    return { success: true }
  }

  async sendMessage(chatId: number, text: string, username?: string) {
    const user = await this.requireUser(username)
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: { include: { participants: true } } },
    })
    if (!participant) throw new NotFoundException('会话不存在')
    if (participant.conversation.dissolvedAt) throw new NotFoundException('会话不存在')
    if (participant.conversation.type === ChatConversationType.GROUP) {
      const now = new Date()
      const muted =
        participant.conversation.mutedAll &&
        participant.groupRole !== ChatGroupRole.OWNER &&
        participant.groupRole !== ChatGroupRole.ADMIN
      const personalMuted = participant.mutedUntil && participant.mutedUntil > now
      if (muted || personalMuted) {
        throw new BadRequestException('当前处于禁言状态，暂无法发送消息')
      }
    }
    const trimmed = String(text || '').trim()
    if (!trimmed) throw new BadRequestException('消息不能为空')

    const created = await this.prisma.chatMessage.create({
      data: {
        conversationId: chatId,
        senderId: user.id,
        type: ChatMessageType.TEXT,
        content: trimmed,
        metadata:
          participant.conversation.type === ChatConversationType.GROUP
            ? {
                senderNickname: participant.groupNickname || user.username,
                senderAvatar: user.uid
                  ? `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.uid)}`
                  : '',
              }
            : undefined,
      },
    })

    await this.prisma.chatConversation.update({ where: { id: chatId }, data: { updatedAt: new Date() } })
    await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { unreadCount: 0, updatedAt: new Date() },
    })

    const others = participant.conversation.participants.filter((p) => p.userId !== user.id)
    for (const other of others) {
      await this.prisma.chatParticipant.update({
        where: { id: other.id },
        data: { unreadCount: { increment: 1 }, updatedAt: new Date() },
      })
    }

    return {
      id: created.id,
      text: created.content,
      self: true,
      time: this.formatTime(created.createdAt),
      ...(participant.conversation.type === ChatConversationType.GROUP
        ? {
            senderNickname: participant.groupNickname || user.username,
            senderAvatar: user.uid
              ? `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.uid)}`
              : '',
          }
        : {}),
    }
  }

  async sendFriendRequest(input: FriendRequestInput, username?: string) {
    const sender = await this.requireUser(username)
    const receiverId = String(input.targetUserId || '').trim()
    if (!receiverId) throw new BadRequestException('targetUserId 不能为空')
    if (receiverId === sender.id) throw new BadRequestException('不能添加自己为好友')
    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } })
    if (!receiver) throw new NotFoundException('未找到相关用户')

    const existed = await this.prisma.friendRequest.findFirst({
      where: { senderId: sender.id, receiverId: receiver.id, status: FriendRequestStatus.PENDING },
    })
    if (existed) throw new ConflictException('申请已发送，请勿重复操作')

    const request = await this.prisma.friendRequest.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        message: String(input.message || '你好，我想添加你为好友。').trim(),
      },
    })

    await this.ensureDefaultConversations(receiver.id)
    const systemConversation = await this.prisma.chatParticipant.findFirst({
      where: { userId: receiver.id, conversation: { type: ChatConversationType.SYSTEM } },
      include: { conversation: true },
    })
    if (systemConversation) {
      await this.prisma.chatMessage.create({
        data: {
          conversationId: systemConversation.conversationId,
          type: ChatMessageType.FRIEND_REQUEST,
          content: `${sender.username} 申请添加好友`,
          metadata: {
            requestId: request.id,
            requestStatus: 'pending',
            requestMessage: request.message,
            targetNickname: sender.username,
            targetUid: sender.uid,
            requestDirection: 'inbound',
          },
        },
      })
      await this.prisma.chatParticipant.update({
        where: { id: systemConversation.id },
        data: { unreadCount: { increment: 1 }, updatedAt: new Date() },
      })
    }

    return {
      requestId: request.id,
      status: 'pending',
      targetUserId: receiver.id,
      message: request.message,
      direction: 'outbound',
    }
  }

  async confirmFriendRequest(requestId: string, username?: string) {
    const receiver = await this.requireUser(username)
    const req = await this.prisma.friendRequest.findUnique({
      where: { id: String(requestId || '') },
      include: { sender: true, receiver: true },
    })
    if (!req || req.receiverId !== receiver.id) throw new NotFoundException('好友申请不存在')
    if (req.status === FriendRequestStatus.ACCEPTED) {
      return { requestId: req.id, status: 'accepted' }
    }

    const [a, b] = [req.senderId, req.receiverId].sort()
    await this.prisma.friendRelation.upsert({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      update: {},
      create: { userAId: a, userBId: b },
    })

    let conversation = await this.prisma.chatConversation.findFirst({
      where: {
        type: ChatConversationType.DIRECT,
        participants: { some: { userId: req.senderId } },
        AND: [{ participants: { some: { userId: req.receiverId } } }],
      },
    })
    if (!conversation) {
      conversation = await this.prisma.chatConversation.create({
        data: {
          type: ChatConversationType.DIRECT,
          participants: {
            create: [{ userId: req.senderId }, { userId: req.receiverId }],
          },
        },
      })
    }

    await this.prisma.friendRequest.update({
      where: { id: req.id },
      data: { status: FriendRequestStatus.ACCEPTED, conversationId: conversation.id },
    })

    const text = '您已添加好友，可以开始聊天啦'
    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        type: ChatMessageType.SYSTEM_NOTICE,
        content: text,
      },
    })
    await this.prisma.chatParticipant.updateMany({
      where: { conversationId: conversation.id },
      data: { unreadCount: { increment: 1 }, updatedAt: new Date() },
    })

    return { requestId: req.id, status: 'accepted', chatId: conversation.id, chatName: req.sender.username }
  }

  async rejectFriendRequest(requestId: string, note?: string, username?: string) {
    const receiver = await this.requireUser(username)
    const req = await this.prisma.friendRequest.findUnique({ where: { id: String(requestId || '') } })
    if (!req || req.receiverId !== receiver.id) throw new NotFoundException('好友申请不存在')
    if (req.status !== FriendRequestStatus.PENDING) return { requestId: req.id, status: req.status.toLowerCase() }
    const rejectNote = String(note || '').trim()
    await this.prisma.friendRequest.update({
      where: { id: req.id },
      data: { status: FriendRequestStatus.REJECTED, rejectNote },
    })
    return { requestId: req.id, status: 'rejected', rejectNote }
  }

  async getPendingFriendRequests(username?: string) {
    const user = await this.requireUser(username)
    const list = await this.prisma.friendRequest.findMany({
      where: { receiverId: user.id, status: FriendRequestStatus.PENDING },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
    })
    return list.map((item) => ({
      requestId: item.id,
      status: 'pending',
      message: item.message,
      createdAt: item.createdAt.toISOString(),
      targetUserId: item.sender.id,
      targetUid: item.sender.uid,
      targetNickname: item.sender.username,
    }))
  }

  async searchFriends(keyword = '', username?: string) {
    const q = String(keyword || '').trim()
    const currentUsername = String(username || '').trim().toLowerCase()
    const users = await this.prisma.user.findMany({
      where: q
        ? {
            status: 'ACTIVE',
            OR: [{ username: { contains: q, mode: 'insensitive' } }, { uid: { contains: q, mode: 'insensitive' } }],
          }
        : { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const mapped = users
      .filter((u) => String(u.username || '').trim().toLowerCase() !== currentUsername)
      .map((u, i) => ({
      id: u.id,
      uid: u.uid,
      username: u.username,
      nickname: u.username,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(u.uid)}`,
      intro: '关注贵金属行情，欢迎交流交易经验。',
      city: '上海',
      tags: ['黄金', '白银'],
      mutualFriends: (i % 6) + 1,
      status: '可添加',
    }))
    return mapped.sort((a, b) => b.mutualFriends - a.mutualFriends)
  }

  async getFriendProfile(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ id: id.trim() }, { uid: id.trim() }], status: 'ACTIVE' },
    })
    if (!user) throw new NotFoundException('未找到相关用户')
    return {
      id: user.id,
      uid: user.uid,
      username: user.username,
      nickname: user.username,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.uid)}`,
      intro: '关注贵金属行情，欢迎交流交易经验。',
      city: '上海',
      tags: ['黄金', '白银'],
      mutualFriends: 0,
      status: '可添加',
    }
  }

  async getGroupCandidates(username?: string) {
    const user = await this.requireUser(username)
    const relations = await this.prisma.friendRelation.findMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
      include: { userA: true, userB: true },
    })
    return relations.map((r) => {
      const target = r.userAId === user.id ? r.userB : r.userA
      return {
        id: target.id,
        uid: target.uid,
        nickname: target.username,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(target.uid)}`,
        role: '群成员',
      }
    })
  }

  async createGroup(input: CreateGroupInput, username?: string) {
    const owner = await this.requireUser(username)
    const name = String(input.name || '').trim()
    if (!name) throw new BadRequestException('群名称不能为空')
    const memberIds = Array.from(new Set((input.memberIds || []).map((x) => String(x).trim()).filter(Boolean)))
    if (memberIds.length < 2) throw new BadRequestException('群成员至少 2 人')

    const conversation = await this.prisma.chatConversation.create({
      data: {
        type: ChatConversationType.GROUP,
        name,
        ownerId: owner.id,
        participants: {
          create: Array.from(new Set([owner.id, ...memberIds])).map((userId) => ({
            userId,
            groupRole: userId === owner.id ? ChatGroupRole.OWNER : ChatGroupRole.MEMBER,
          })),
        },
      },
    })
    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        type: ChatMessageType.SYSTEM_NOTICE,
        content: input.notice ? `群公告：${input.notice}` : `群聊 ${name} 创建成功，欢迎交流。`,
      },
    })
    return { groupId: `grp_${conversation.id}`, chatId: conversation.id, name, memberCount: memberIds.length, status: 'created' }
  }

  async getGroupMembers(chatId: number, username?: string) {
    const user = await this.requireUser(username)
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!participant || participant.conversation.type !== ChatConversationType.GROUP) {
      throw new NotFoundException('群聊不存在')
    }
    const members = await this.prisma.chatParticipant.findMany({
      where: { conversationId: chatId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })
    return members.map((m) => ({
      userId: m.user.id,
      uid: m.user.uid,
      username: m.user.username,
      isOwner: participant.conversation.ownerId === m.user.id,
      role: m.groupRole,
      groupNickname: m.groupNickname || m.user.username,
      notificationMuted: m.notificationMuted,
      mutedUntil: m.mutedUntil,
    }))
  }

  async renameGroup(chatId: number, name: string, username?: string) {
    const user = await this.requireUser(username)
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id: chatId } })
    if (!conversation || conversation.type !== ChatConversationType.GROUP) {
      throw new NotFoundException('群聊不存在')
    }
    if (conversation.ownerId !== user.id) {
      throw new BadRequestException('仅群主可修改群名称')
    }
    const newName = String(name || '').trim()
    if (!newName) throw new BadRequestException('群名称不能为空')
    await this.prisma.chatConversation.update({
      where: { id: chatId },
      data: { name: newName, updatedAt: new Date() },
    })
    await this.prisma.chatMessage.create({
      data: {
        conversationId: chatId,
        type: ChatMessageType.SYSTEM_NOTICE,
        content: `群名称已修改为「${newName}」`,
      },
    })
    return { chatId, name: newName, status: 'renamed' }
  }

  async leaveGroup(chatId: number, username?: string) {
    const user = await this.requireUser(username)
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!participant || participant.conversation.type !== ChatConversationType.GROUP) {
      throw new NotFoundException('群聊不存在')
    }
    if (participant.conversation.ownerId === user.id) {
      throw new BadRequestException('群主不能直接退群，请先移交群主或解散群')
    }
    await this.prisma.chatParticipant.delete({ where: { id: participant.id } })
    await this.prisma.chatMessage.create({
      data: {
        conversationId: chatId,
        type: ChatMessageType.SYSTEM_NOTICE,
        content: `${user.username} 已退出群聊`,
      },
    })
    return { chatId, status: 'left' }
  }

  async removeGroupMember(chatId: number, memberUserId: string, username?: string) {
    const operator = await this.requireUser(username)
    const conversation = await this.prisma.chatConversation.findUnique({ where: { id: chatId } })
    if (!conversation || conversation.type !== ChatConversationType.GROUP) {
      throw new NotFoundException('群聊不存在')
    }
    if (conversation.ownerId !== operator.id) {
      throw new BadRequestException('仅群主可移除成员')
    }
    if (memberUserId === operator.id) {
      throw new BadRequestException('不能移除自己')
    }
    const member = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: String(memberUserId || '').trim() } },
      include: { user: true },
    })
    if (!member) throw new NotFoundException('群成员不存在')
    await this.prisma.chatParticipant.delete({ where: { id: member.id } })
    await this.prisma.chatMessage.create({
      data: {
        conversationId: chatId,
        type: ChatMessageType.SYSTEM_NOTICE,
        content: `${member.user.username} 已被移出群聊`,
      },
    })
    return { chatId, memberUserId: member.user.id, status: 'removed' }
  }

  async getGroupSettings(chatId: number, username?: string) {
    const user = await this.requireUser(username)
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!participant || participant.conversation.type !== ChatConversationType.GROUP) {
      throw new NotFoundException('群聊不存在')
    }
    return {
      chatId,
      name: participant.conversation.name || '',
      avatarUrl: participant.conversation.avatarUrl || '',
      notice: participant.conversation.notice || '',
      mutedAll: participant.conversation.mutedAll,
      ownerId: participant.conversation.ownerId || '',
      myRole: participant.groupRole,
      myGroupNickname: participant.groupNickname || user.username,
      myNotificationMuted: participant.notificationMuted,
    }
  }

  async updateGroupSettings(
    chatId: number,
    payload: { name?: string; avatarUrl?: string; notice?: string; mutedAll?: boolean },
    username?: string,
  ) {
    const user = await this.requireUser(username)
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!participant || participant.conversation.type !== ChatConversationType.GROUP) throw new NotFoundException('群聊不存在')
    if (participant.groupRole !== ChatGroupRole.OWNER && participant.groupRole !== ChatGroupRole.ADMIN) {
      throw new BadRequestException('仅群主/管理员可操作')
    }
    const previous = {
      name: String(participant.conversation.name || ''),
      avatarUrl: String(participant.conversation.avatarUrl || ''),
      notice: String(participant.conversation.notice || ''),
      mutedAll: Boolean(participant.conversation.mutedAll),
    }

    const data: Record<string, unknown> = { updatedAt: new Date() }
    if (typeof payload.name === 'string') data.name = payload.name.trim()
    if (typeof payload.avatarUrl === 'string') data.avatarUrl = payload.avatarUrl.trim()
    if (typeof payload.notice === 'string') data.notice = payload.notice.trim()
    if (typeof payload.mutedAll === 'boolean') data.mutedAll = payload.mutedAll

    const updatedConversation = await this.prisma.chatConversation.update({ where: { id: chatId }, data })

    const changes: string[] = []
    if (typeof payload.name === 'string' && payload.name.trim() !== previous.name) changes.push('群名称')
    if (typeof payload.avatarUrl === 'string' && payload.avatarUrl.trim() !== previous.avatarUrl) changes.push('群头像')
    if (typeof payload.notice === 'string' && payload.notice.trim() !== previous.notice) changes.push('群公告')
    if (typeof payload.mutedAll === 'boolean' && payload.mutedAll !== previous.mutedAll) {
      changes.push(payload.mutedAll ? '开启全员禁言' : '关闭全员禁言')
    }

    if (changes.length > 0) {
      await this.prisma.chatMessage.create({
        data: {
          conversationId: chatId,
          type: ChatMessageType.SYSTEM_NOTICE,
          content: `${user.username} 更新了群设置：${changes.join('、')}`,
        },
      })
    }

    const participants = await this.prisma.chatParticipant.findMany({
      where: { conversationId: chatId },
      select: { id: true, userId: true },
    })
    for (const p of participants) {
      await this.prisma.chatParticipant.update({
        where: { id: p.id },
        data: {
          unreadCount: p.userId === user.id ? 0 : { increment: changes.length > 0 ? 1 : 0 },
          updatedAt: updatedConversation.updatedAt,
        },
      })
    }
    return { chatId, status: 'updated' }
  }

  async updateMyGroupProfile(
    chatId: number,
    payload: { groupNickname?: string; notificationMuted?: boolean },
    username?: string,
  ) {
    const user = await this.requireUser(username)
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!participant || participant.conversation.type !== ChatConversationType.GROUP) throw new NotFoundException('群聊不存在')
    await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data: {
        ...(typeof payload.groupNickname === 'string' ? { groupNickname: payload.groupNickname.trim() } : {}),
        ...(typeof payload.notificationMuted === 'boolean' ? { notificationMuted: payload.notificationMuted } : {}),
      },
    })
    return { chatId, status: 'updated' }
  }

  async inviteGroupMembers(chatId: number, memberIds: string[], username?: string) {
    const user = await this.requireUser(username)
    const operator = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!operator || operator.conversation.type !== ChatConversationType.GROUP) throw new NotFoundException('群聊不存在')
    const cleanIds = Array.from(new Set(memberIds.map((x) => String(x || '').trim()).filter(Boolean)))
    let added = 0
    for (const memberUserId of cleanIds) {
      const existed = await this.prisma.chatParticipant.findUnique({
        where: { conversationId_userId: { conversationId: chatId, userId: memberUserId } },
      })
      if (existed) continue
      await this.prisma.chatParticipant.create({
        data: { conversationId: chatId, userId: memberUserId, groupRole: ChatGroupRole.MEMBER },
      })
      added += 1
    }
    await this.prisma.chatConversation.update({ where: { id: chatId }, data: { updatedAt: new Date() } })
    return { chatId, added }
  }

  async clearGroupHistory(chatId: number, username?: string) {
    const user = await this.requireUser(username)
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!participant || participant.conversation.type !== ChatConversationType.GROUP) throw new NotFoundException('群聊不存在')
    const now = new Date()
    await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { clearedAt: now, unreadCount: 0, updatedAt: now },
    })
    return { chatId, status: 'cleared' }
  }

  async muteGroupMember(chatId: number, memberUserId: string, durationMinutes: number, username?: string) {
    const user = await this.requireUser(username)
    const operator = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!operator || operator.conversation.type !== ChatConversationType.GROUP) throw new NotFoundException('群聊不存在')
    if (operator.groupRole !== ChatGroupRole.OWNER && operator.groupRole !== ChatGroupRole.ADMIN) {
      throw new BadRequestException('仅群主/管理员可操作')
    }
    const target = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: String(memberUserId || '').trim() } },
    })
    if (!target) throw new NotFoundException('群成员不存在')
    const mutedUntil = durationMinutes > 0 ? new Date(Date.now() + durationMinutes * 60 * 1000) : null
    await this.prisma.chatParticipant.update({ where: { id: target.id }, data: { mutedUntil } })
    return { chatId, memberUserId: target.userId, mutedUntil }
  }

  async transferGroupOwner(chatId: number, toUserId: string, username?: string) {
    const user = await this.requireUser(username)
    const operator = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!operator || operator.conversation.type !== ChatConversationType.GROUP) throw new NotFoundException('群聊不存在')
    if (operator.groupRole !== ChatGroupRole.OWNER) throw new BadRequestException('仅群主可转让')
    const target = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: String(toUserId || '').trim() } },
    })
    if (!target) throw new NotFoundException('目标成员不存在')
    await this.prisma.$transaction([
      this.prisma.chatParticipant.update({ where: { id: operator.id }, data: { groupRole: ChatGroupRole.ADMIN } }),
      this.prisma.chatParticipant.update({ where: { id: target.id }, data: { groupRole: ChatGroupRole.OWNER } }),
      this.prisma.chatConversation.update({ where: { id: chatId }, data: { ownerId: target.userId, updatedAt: new Date() } }),
    ])
    return { chatId, ownerId: target.userId, status: 'transferred' }
  }

  async dissolveGroup(chatId: number, username?: string) {
    const user = await this.requireUser(username)
    const operator = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chatId, userId: user.id } },
      include: { conversation: true },
    })
    if (!operator || operator.conversation.type !== ChatConversationType.GROUP) throw new NotFoundException('群聊不存在')
    if (operator.groupRole !== ChatGroupRole.OWNER) throw new BadRequestException('仅群主可解散群聊')
    await this.prisma.chatConversation.update({
      where: { id: chatId },
      data: { dissolvedAt: new Date(), updatedAt: new Date() },
    })
    return { chatId, status: 'dissolved' }
  }

  async parseScan(code: string) {
    const rawCode = String(code || '').trim()
    if (!rawCode) throw new BadRequestException('二维码无效或格式不支持')
    if (rawCode.startsWith('expired:') || rawCode.startsWith('exp:') || rawCode.includes('expired')) {
      throw new GoneException('二维码已失效')
    }
    throw new BadRequestException('二维码无效或格式不支持')
  }

  async getMyQrCode() {
    const user = await this.prisma.user.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      include: { paymentProfile: true },
    })
    const uid = user?.uid || 'U0001001'
    const displayName = user?.paymentProfile?.displayName || user?.username || '黄金投资者_888'
    const qrPayload = user?.paymentProfile?.qrPayload || `jinlian://pay?uid=${encodeURIComponent(uid)}&name=${encodeURIComponent(displayName)}`
    return {
      uid,
      displayName,
      qrPayload,
      slogan: '支付先扣增值后扣本金，收款方可能产生手续费',
      nickname: displayName,
      qrCode: '',
      tips: ['扫码可添加我为好友', '支付时先扣增值后扣本金', '收款方可能产生手续费'],
    }
  }

  async getTransferTargets(query: TransferTargetsQuery) {
    if (query.chatType === 'system') return []
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      take: 5,
    })
    return users.map((u) => ({
      id: u.id,
      uid: u.uid,
      nickname: u.username,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(u.uid)}`,
    }))
  }

  async sendTransfer(input: SendTransferInput) {
    const user = await this.requireUser(input.username)
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId: Number(input.chatId), userId: user.id } },
      include: { conversation: { include: { participants: true } } },
    })
    if (!participant) throw new NotFoundException('会话不存在')
    if (participant.conversation.type === ChatConversationType.SYSTEM) {
      throw new BadRequestException('系统会话不支持转账')
    }

    const amount = Number(input.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('转账金额无效')

    const receiverFeeRate = 0.001
    const receiverFeeAmount = Number((amount <= 100 ? 0 : amount * receiverFeeRate).toFixed(2))
    const netAmount = Number((amount - receiverFeeAmount).toFixed(2))
    const appreciationUsed = Number((amount * 0.6).toFixed(2))
    const principalUsed = Number((amount - appreciationUsed).toFixed(2))
    const recipientName = String(input.recipientName || '').trim()
    const recipientUid = String(input.recipientUid || '').trim()
    const note = String(input.note || '').trim()
    const orderId = `pay_${Date.now()}`
    const text = `转账 ¥${amount.toFixed(2)}${recipientName ? ` 给 ${recipientName}` : ''}`

    const created = await this.prisma.chatMessage.create({
      data: {
        conversationId: Number(input.chatId),
        senderId: user.id,
        type: ChatMessageType.TRANSFER,
        content: text,
        metadata: {
          amount,
          recipientName,
          recipientUid,
          note,
          status: 'completed',
          orderId,
          feeRate: receiverFeeRate,
          netAmount,
          appreciationUsed,
          principalUsed,
          receiverFeeRate,
          receiverFeeAmount,
          receiverNetAmount: netAmount,
        },
      },
    })
    await this.prisma.chatConversation.update({
      where: { id: Number(input.chatId) },
      data: { updatedAt: new Date() },
    })
    await this.prisma.chatParticipant.update({
      where: { id: participant.id },
      data: { unreadCount: 0, updatedAt: new Date() },
    })
    const others = participant.conversation.participants.filter((p) => p.userId !== user.id)
    for (const other of others) {
      await this.prisma.chatParticipant.update({
        where: { id: other.id },
        data: { unreadCount: { increment: 1 }, updatedAt: new Date() },
      })
    }

    return {
      id: created.id,
      type: 'transfer',
      text,
      self: true,
      time: this.formatTime(created.createdAt),
      amount,
      recipientName,
      recipientUid,
      note,
      status: 'completed',
      orderId,
      chatId: input.chatId,
      feeRate: receiverFeeRate,
      netAmount,
      appreciationUsed,
      principalUsed,
      receiverFeeRate,
      receiverFeeAmount,
      receiverNetAmount: netAmount,
    }
  }
}
