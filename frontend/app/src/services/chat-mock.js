const createQrDataUri = (label = '金影子二维码') => {
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
      <text x="120" y="226" text-anchor="middle" font-size="14" fill="#64748b" font-family="Arial, sans-serif">${label}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const cloneChatMock = (value) => JSON.parse(JSON.stringify(value))

export const chatListMock = [
  {
    id: 1,
    nameKey: 'chat.list.system.name',
    name: 'System',
    lastMsgKey: 'chat.list.system.lastMsg',
    lastMsg: 'Your real-name verification has passed',
    time: '10:30',
    type: 'system',
  },
  {
    id: 2,
    nameKey: 'chat.list.service.name',
    name: 'Service Agent',
    lastMsgKey: 'chat.list.service.lastMsg',
    lastMsg: 'Hello, how may I help you?',
    time: '09:15',
    type: 'user',
  },
  {
    id: 3,
    nameKey: 'chat.list.group.name',
    name: 'Global Gold Group',
    lastMsgKey: 'chat.list.group.lastMsg',
    lastMsg: 'Zhang: Gold price is strong today',
    timeKey: 'chat.timeYesterday',
    time: 'Yesterday',
    type: 'group',
  },
]

export const chatMessagesMock = {
  1: [
    { id: 10101, textKey: 'chat.message.system.verified', text: 'Your real-name verification has passed.', self: false, time: '10:12' },
    { id: 10102, textKey: 'chat.message.system.permission', text: 'You now have full trading permissions.', self: false, time: '10:30' },
  ],
  2: [
    { id: 20101, textKey: 'chat.message.service.greeting', text: 'Hello, how may I help you?', self: false, time: '09:15' },
    { id: 20102, textKey: 'chat.message.service.askRule', text: 'I want to know the buy-anchor rules.', self: true, time: '09:16' },
    { id: 20103, textKey: 'chat.message.service.replyRule', text: 'Sure, I will send you the latest guide.', self: false, time: '09:18' },
  ],
  3: [
    { id: 30101, textKey: 'chat.message.group.msg1', text: 'Zhang: Gold price is strong today', self: false, timeKey: 'chat.timeYesterday', time: 'Yesterday' },
    { id: 30102, textKey: 'chat.message.group.msg2', text: 'Li: Night session rhythm is critical.', self: false, timeKey: 'chat.timeYesterday', time: 'Yesterday' },
    { id: 30103, textKey: 'chat.message.group.msg3', text: 'Me: Watching the 485 line first.', self: true, timeKey: 'chat.timeYesterday', time: 'Yesterday' },
  ],
}

export const friendDirectoryMock = [
  {
    id: 101,
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
    id: 102,
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
    id: 103,
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

export const groupCandidatesMock = [
  {
    id: 201,
    uid: 'U0002201',
    nickname: '贵金属套利营',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-1',
    role: '群成员',
  },
  {
    id: 202,
    uid: 'U0002202',
    nickname: '盘中快讯官',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-2',
    role: '群成员',
  },
  {
    id: 203,
    uid: 'U0002203',
    nickname: '量化小队长',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-3',
    role: '群成员',
  },
  {
    id: 204,
    uid: 'U0002204',
    nickname: '白银策略官',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-4',
    role: '群成员',
  },
]

export const scanEntriesMock = [
  {
    code: 'friend:101',
    title: '好友二维码',
    subtitle: '识别后可查看用户信息并发起好友申请',
    type: 'friend',
  },
  {
    code: 'group:3301',
    title: '群聊二维码',
    subtitle: '识别后可加入贵金属快讯群',
    type: 'group',
  },
  {
    code: 'url:activity-88',
    title: '活动二维码',
    subtitle: '识别后跳转到官方活动说明',
    type: 'url',
  },
]

export const myQrMock = {
  uid: 'U0001001',
  displayName: '黄金投资者_888',
  nickname: '黄金投资者_888',
  qrPayload: 'jinlian://pay?uid=U0001001&name=%E9%BB%84%E9%87%91%E6%8A%95%E8%B5%84%E8%80%85_888',
  slogan: '支付先扣增值后扣本金，收款方可能产生手续费',
  qrCode: createQrDataUri('金影子·我的二维码'),
  tips: ['扫码可添加我为好友', '仅展示模拟二维码，用于页面展示'],
}

export const buildFriendSearchResult = (keyword = '') => {
  const q = keyword.trim().toLowerCase()
  if (!q) return friendDirectoryMock
  return friendDirectoryMock.filter((item) => {
    return item.nickname.toLowerCase().includes(q) || item.uid.toLowerCase().includes(q)
  })
}

export const buildScanResult = (code) => {
  if (code === 'friend:101') {
    return {
      type: 'friend',
      title: '识别到好友二维码',
      description: '可查看金市观察员资料并发起好友申请',
      actionLabel: '查看用户信息',
      targetId: 101,
    }
  }

  if (code === 'group:3301') {
    return {
      type: 'group',
      title: '识别到群聊二维码',
      description: '可加入“全球黄金交流群”并直接进入群聊',
      actionLabel: '加入并进入群聊',
      targetId: 3,
    }
  }

  return {
    type: 'url',
    title: '识别到活动二维码',
    description: '已解析为官方活动链接，可在后续接入真实跳转。',
    actionLabel: '查看活动说明',
    targetId: 'activity-88',
  }
}

export const buildTransferTargets = ({ chatType, chatTitle }) => {
  if (chatType === 'group') {
    return groupCandidatesMock.map((item) => ({
      id: item.id,
      nickname: item.nickname,
      avatar: item.avatar,
      uid: item.uid,
    }))
  }

  const matchedFriend = friendDirectoryMock.find((item) => item.nickname === chatTitle) || friendDirectoryMock[0]
  return matchedFriend
    ? [{
      id: matchedFriend.id,
      nickname: matchedFriend.nickname,
      avatar: matchedFriend.avatar,
      uid: matchedFriend.uid,
    }]
    : []
}

export const buildTransferMessage = ({ amount, recipientName, note = '' }) => ({
  id: Date.now(),
  type: 'transfer',
  self: true,
  amount,
  recipientName,
  note,
  status: 'completed',
  text: `Transfer ¥${Number(amount).toFixed(2)} to ${recipientName}`,
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
})
