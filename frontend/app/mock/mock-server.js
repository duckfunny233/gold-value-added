import express from 'express'
import cors from 'cors'
import path from 'path';
import { fileURLToPath } from 'url';
import {
  auditData,
  dashboardData,
  fundsData,
  leaderboardData,
  reportsData,
  riskData,
  tradesData,
  usersData,
} from './admin-data.js'

const app = express()
const port = 3000
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors())
app.use(express.json())
app.use('/static', express.static('../public'));

const TIANAPI_NEWS_URL = 'https://apis.tianapi.com/caijing/index'
const newsDetailCache = new Map()

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const requireNewsApiKey = () => {
  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey) {
    throw new Error('NEWS_API_KEY 未配置')
  }

  return apiKey
}

const createNewsContent = ({ title, summary, source, url }) => {
  const blocks = [
    `<p class="mb-4">${escapeHtml(summary || title)}</p>`,
    `<p class="mb-4">文章来源：${escapeHtml(source || '天行财经')}</p>`
  ]

  if (url) {
    blocks.push(
      `<p class="mb-4">原文链接：<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>`
    )
  }

  return blocks.join('')
}

const extractTianNewsItems = (result) => {
  if (Array.isArray(result)) {
    return {
      items: result,
      total: result.length
    }
  }

  if (!result || typeof result !== 'object') {
    return {
      items: [],
      total: 0
    }
  }

  const items = Array.isArray(result.newslist)
    ? result.newslist
    : Array.isArray(result.list)
      ? result.list
      : Array.isArray(result.items)
        ? result.items
        : (result.id && result.title ? [result] : [])

  const parsedTotal = Number(result.allnum || result.total || result.count || items.length)

  return {
    items,
    total: Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : items.length
  }
}

const normalizeNewsItem = (item, page, limit, index) => {
  const title = String(item?.title || '').trim()
  if (!title) {
    return null
  }

  const id = String(item.id || `news_${page}_${index}`)
  const summary = String(item.description || '').trim()
  const date = String(item.ctime || '').trim()
  const image = String(item.picUrl || '').trim()
  const author = String(item.source || '天行财经').trim()
  const linkUrl = String(item.url || '').trim()

  const normalized = {
    id,
    title,
    date,
    summary,
    thumbnail: image,
    views: '-'
  }

  newsDetailCache.set(id, {
    id,
    title,
    date,
    views: '-',
    author,
    image,
    content: createNewsContent({
      title,
      summary,
      source: author,
      url: linkUrl
    })
  })

  return normalized
}

const fetchTianNewsPage = async (page = 1, limit = 10) => {
  const requestUrl = new URL(TIANAPI_NEWS_URL)
  requestUrl.searchParams.set('key', requireNewsApiKey())
  requestUrl.searchParams.set('page', String(page))
  requestUrl.searchParams.set('num', String(limit))

  const response = await fetch(requestUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`财经新闻拉取失败: HTTP ${response.status}`)
  }

  const payload = await response.json()
  if (Number(payload.code) !== 200) {
    throw new Error(String(payload.msg || '财经新闻拉取失败'))
  }

  const { items, total } = extractTianNewsItems(payload.result)
  const normalizedItems = items
    .map((item, index) => normalizeNewsItem(item, page, limit, index))
    .filter(Boolean)

  if (!normalizedItems.length) {
    throw new Error('财经新闻接口未返回可用数据')
  }

  return {
    items: normalizedItems,
    total
  }
}

// 1. 获取新闻列表 (支持分页)
app.get('/api/news', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1')
    const limit = parseInt(req.query.limit || '5')
    const { items, total } = await fetchTianNewsPage(page, limit)

    res.json({
      code: 200,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    })
  } catch (error) {
    return sendUpstreamError(res, error, '财经新闻列表获取失败')
  }
})

// 1.1 获取新闻详情
app.get('/api/news/:id', async (req, res) => {
  try {
    const { id } = req.params
    let detail = newsDetailCache.get(id)

    if (!detail) {
      await fetchTianNewsPage(1, 50)
      detail = newsDetailCache.get(id)
    }

    if (!detail) {
      return res.status(404).json({ code: 404, message: '新闻不存在' })
    }

    res.json({
      code: 200,
      data: detail
    })
  } catch (error) {
    return sendUpstreamError(res, error, '财经新闻详情获取失败')
  }
})

// 2. 实时行情 (Market Prices)
const OUNCE_TO_GRAM = 31.1035
const liveMetalConfig = {
  AU9999: {
    name: '现货黄金',
    symbol: 'XAU',
    url: 'https://api.gold-api.com/price/XAU/CNY'
  },
  AG9999: {
    name: '现货白银',
    symbol: 'XAG',
    url: 'https://api.gold-api.com/price/XAG/CNY'
  }
}
const latestLiveMetalPrices = new Map()
const staticMarketData = {
  USDX: { name: '美指', price: 104.15, base: 104.00 },
  OIL: { name: '原油', price: 78.50, base: 78.00 }
}
const profilePositionTemplates = {
  gold: [
    { level: '影子金币', weight: 10, count: 2, bgImage: '/images/金影子金币.jpg' },
    { level: '影子金币', weight: 50, count: 1, bgImage: '/images/金叶币.jpg' },
    { level: '影子金币', weight: 500, count: 0, bgImage: '/images/影子金币.jpg' },
    { level: '黄金条', weight: 5000, count: 0, bgImage: '/images/黄金条.jpg' },
    { level: '黄金砖', weight: 50000, count: 0, bgImage: '/images/黄金砖.jpg' }
  ],
  silver: [
    { level: '影子金币', weight: 10, count: 10, bgImage: '/images/金影子金币.jpg' },
    { level: '影子金币', weight: 50, count: 3, bgImage: '/images/金叶币_银.jpg' },
    { level: '影子金币', weight: 500, count: 1, bgImage: '/images/影子金币_银.jpg' },
    { level: '黄金条', weight: 5000, count: 0, bgImage: '/images/黄金条_银.jpg' },
    { level: '黄金砖', weight: 50000, count: 0, bgImage: '/images/黄金砖_银.jpg' }
  ]
}
let profileBaseBalance = 85400
const profileYesterdayProfit = 12450
const profileAccumulatedProfit = 450200
const rechargeOrders = new Map()
const withdrawSmsTokens = new Map()

const formatMoney = (value) =>
  Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const sendUpstreamError = (res, error, message) => {
  console.error(message, error)
  return res.status(502).json({
    code: 502,
    message
  })
}

const fetchLiveMetalSnapshot = async (assetId) => {
  const config = liveMetalConfig[assetId]
  if (!config) {
    throw new Error(`unsupported_live_asset:${assetId}`)
  }

  const response = await fetch(config.url)
  if (!response.ok) {
    throw new Error(`gold_api_http_${response.status}`)
  }

  const payload = await response.json()
  const ouncePrice = Number(payload.price)
  if (!Number.isFinite(ouncePrice)) {
    throw new Error(`gold_api_invalid_price:${assetId}`)
  }

  return {
    assetId,
    name: config.name,
    symbol: config.symbol,
    pricePerGram: Number((ouncePrice / OUNCE_TO_GRAM).toFixed(2)),
    currency: payload.currency || 'CNY',
    currencySymbol: payload.currencySymbol || '¥',
    updatedAt: payload.updatedAt || new Date().toISOString(),
    updatedAtReadable: payload.updatedAtReadable || 'just now'
  }
}

const buildLiveMarketRow = async (assetId) => {
  const snapshot = await fetchLiveMetalSnapshot(assetId)
  const previousPrice = latestLiveMetalPrices.get(assetId) ?? snapshot.pricePerGram
  const percentChange = previousPrice === 0
    ? 0
    : ((snapshot.pricePerGram - previousPrice) / previousPrice) * 100

  latestLiveMetalPrices.set(assetId, snapshot.pricePerGram)

  return {
    id: assetId,
    name: snapshot.name,
    symbol: snapshot.symbol,
    price: snapshot.pricePerGram,
    change: `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`,
    up: percentChange >= 0,
    currency: snapshot.currency,
    currencySymbol: snapshot.currencySymbol,
    updatedAt: snapshot.updatedAt,
    updatedAtReadable: snapshot.updatedAtReadable
  }
}

const buildStaticMarketRows = () =>
  Object.entries(staticMarketData).map(([id, item]) => {
    const volatility = item.price * 0.0005
    const change = (Math.random() - 0.5) * volatility
    item.price = parseFloat((item.price + change).toFixed(2))

    const percentChange = ((item.price - item.base) / item.base) * 100

    return {
      id,
      name: item.name,
      price: item.price,
      change: `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`,
      up: percentChange >= 0
    }
  })

const resolveAssetPrice = async (assetId) => {
  if (liveMetalConfig[assetId]) {
    const snapshot = await fetchLiveMetalSnapshot(assetId)
    return snapshot.pricePerGram
  }

  const staticAsset = staticMarketData[assetId]
  return staticAsset ? staticAsset.price : 0
}

const buildProfilePositions = (templates, pricePerGram) =>
  templates.map((item) => ({
    level: item.level,
    weight: `${item.weight}g`,
    price: formatMoney(item.weight * pricePerGram),
    count: item.count,
    bgImage: item.bgImage
  }))

const calculatePositionsValue = (positions) =>
  positions.reduce((sum, item) => {
    const itemPrice = parseFloat(String(item.price).replace(/,/g, '')) || 0
    const count = Number(item.count) || 0
    return sum + itemPrice * count
  }, 0)

app.get('/api/market/prices', async (req, res) => {
  try {
    const liveRows = await Promise.all([
      buildLiveMarketRow('AU9999'),
      buildLiveMarketRow('AG9999')
    ])

    res.json({
      code: 200,
      data: [...liveRows, ...buildStaticMarketRows()]
    })
  } catch (error) {
    return sendUpstreamError(res, error, '实时贵金属行情获取失败')
  }
})

// 2.1 K线周期配置
app.get('/api/market/periods', (req, res) => {
  res.json({
    code: 200,
    data: [
      { label: 'market.timeShare', value: '1m', type: 'area' },
      { label: 'market.dailyK', value: 'daily', type: 'candle' },
      { label: 'market.weeklyK', value: 'weekly', type: 'candle' },
      { label: 'market.monthlyK', value: 'monthly', type: 'candle' },
      { label: 'market.quarterlyK', value: 'quarterly', type: 'candle' },
      { label: 'market.yearlyK', value: 'yearly', type: 'candle' }
    ]
  })
})

// 3. 登录 & 认证 (Auth)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  if (password === 'error') {
    return res.status(401).json({ message: '用户名或密码错误' })
  }
  res.json({
    code: 200,
    message: '登录成功',
    data: {
      token: 'real-mock-token-' + Math.random().toString(36).substr(2),
      user: {
        id: '10001',
        username: username,
        nickname: '金影子实盘用户',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GoldInvestor',
        balance: 10000.00,
        accountStatus: 'verified'
      }
    }
  })
})

app.post('/api/auth/logout', (req, res) => {
  res.json({
    code: 200,
    message: '已安全退出登录'
  })
})

app.post('/api/auth/register', (req, res) => {
  const { username } = req.body
  setTimeout(() => {
    res.json({
      code: 200,
      message: '注册成功'
    })
  }, 1000)
})

app.post('/api/auth/reset-password', (req, res) => {
  setTimeout(() => {
    res.json({
      code: 200,
      message: '密码重置成功'
    })
  }, 1000)
})

app.post('/api/auth/send-otp', (req, res) => {
  res.json({
    code: 200,
    message: '验证码已发送'
  })
})

// 4. 公告
app.get('/api/notice', (req, res) => {
  res.json({
    code: 200,
    text: "【调试模式】当前正在使用局域网 Mock Server 提供数据支持。"
  })
})

// 5. 通讯 (Chat)
const chats = [
  { id: 1, name: '系统消息', lastMsg: '您的账户实名认证已通过', time: '10:30', type: 'system' },
  { id: 2, name: '客服专员', lastMsg: '您好，请问有什么可以帮您的？', time: '09:15', type: 'user' },
  { id: 3, name: '全球黄金交流群', lastMsg: '张三: 今天的金价涨势不错', time: '昨天', type: 'group' },
]

// 模拟生成大量历史消息
const generateMessages = (chatId, count = 50) => {
  return Array.from({ length: count }, (_, i) => ({
    id: chatId * 1000 + i,
    text: `这是第 ${i + 1} 条消息内容，模拟历史聊天记录。`,
    self: i % 3 === 0,
    time: `10:${(i % 60).toString().padStart(2, '0')}`
  }))
}

const chatMessages = {
  1: generateMessages(1, 15),
  2: generateMessages(2, 60),
  3: generateMessages(3, 40)
}

const friendDirectory = [
  {
    id: 101,
    uid: 'U0002101',
    nickname: '金市观察员',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=gold-observer',
    intro: '擅长贵金属波段分析，常分享上金所盘面观察。',
    city: '上海',
    tags: ['黄金', '行情分析', 'AU9999'],
    mutualFriends: 3,
    status: '可添加'
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
    status: '可添加'
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
    status: '可添加'
  }
]

const groupCandidates = [
  {
    id: 201,
    uid: 'U0002201',
    nickname: '贵金属套利营',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-1',
    role: '群成员'
  },
  {
    id: 202,
    uid: 'U0002202',
    nickname: '盘中快讯官',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-2',
    role: '群成员'
  },
  {
    id: 203,
    uid: 'U0002203',
    nickname: '量化小队长',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-3',
    role: '群成员'
  },
  {
    id: 204,
    uid: 'U0002204',
    nickname: '白银策略官',
    avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=group-4',
    role: '群成员'
  }
]

const friendRequests = []

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

const scanResultMap = {
  'friend:101': {
    type: 'friend',
    title: '识别到好友二维码',
    description: '可查看金市观察员资料并发起好友申请',
    actionLabel: '查看用户信息',
    targetId: 101
  },
  'group:3301': {
    type: 'group',
    title: '识别到群聊二维码',
    description: '可加入“全球黄金交流群”并直接进入群聊',
    actionLabel: '加入并进入群聊',
    targetId: 3
  },
  'url:activity-88': {
    type: 'url',
    title: '识别到活动二维码',
    description: '已解析为官方活动链接，可在后续接入真实跳转。',
    actionLabel: '查看活动说明',
    targetId: 'activity-88'
  }
}

// --- 模拟机器人自动发言定时任务 ---
const robotNames = ['王五', '李雷', '韩梅梅', '交易员-小明', '金市分析师']
const robotMessages = [
  '感觉今天下午有一波行情，大家怎么看？',
  '刚才那个支撑位守住了，可能会反弹。',
  '大家注意，美联储会议纪要快要公布了。',
  '实物金最近溢价有点高啊。',
  '反弹无力，我先撤了。',
  '又是赚钱的一天，美滋滋。',
  '黄金 9999 现在的价格很适合定投。'
]

setInterval(() => {
  const chatId = 3 // 模拟在交流群发言
  const robotName = robotNames[Math.floor(Math.random() * robotNames.length)]
  const text = `[${robotName}]: ${robotMessages[Math.floor(Math.random() * robotMessages.length)]}`
  
  const newMessage = {
    id: Date.now(),
    text,
    self: false,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  
  chatMessages[chatId].push(newMessage)
  // 更新列表里的最后一条消息
  const chat = chats.find(c => c.id === chatId)
  if (chat) {
    chat.lastMsg = text
    chat.time = newMessage.time
  }
}, 8000) // 每8秒发送一条
// --------------------------------

app.get('/api/chat/list', (req, res) => {
  res.json({
    code: 200,
    data: chats
  })
})

app.get('/api/chat/messages/:id', (req, res) => {
  const { id } = req.params
  const page = parseInt(req.query.page || '1')
  const limit = parseInt(req.query.limit || '20')
  
  const allMsgs = chatMessages[id] || []
  const total = allMsgs.length
  
  // 模拟从后往前分页（聊天习惯：第一页是最近的20条）
  const start = Math.max(0, total - page * limit)
  const end = Math.max(0, total - (page - 1) * limit)
  
  const items = end > 0 ? allMsgs.slice(start, end) : []

  setTimeout(() => {
    res.json({
      code: 200,
      data: {
        items,
        total,
        hasMore: start > 0
      }
    })
  }, 400) // 模拟网络延迟
})

app.post('/api/chat/send', (req, res) => {
  const { chatId, text } = req.body
  const newMessage = {
    id: Date.now(),
    text,
    self: true,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  
  if (chatMessages[chatId]) {
    chatMessages[chatId].push(newMessage)
  }

  res.json({
    code: 200,
    data: newMessage
  })
})

app.get('/api/chat/friend-search', (req, res) => {
  const keyword = String(req.query.keyword || '').trim().toLowerCase()
  const items = keyword
    ? friendDirectory.filter((item) => item.nickname.toLowerCase().includes(keyword) || item.uid.toLowerCase().includes(keyword))
    : friendDirectory

  res.json({
    code: 200,
    data: items
  })
})

app.get('/api/chat/friend-profile/:id', (req, res) => {
  const item = friendDirectory.find((friend) => String(friend.id) === String(req.params.id))

  if (!item) {
    return res.status(404).json({ code: 404, message: '未找到该用户' })
  }

  res.json({
    code: 200,
    data: item
  })
})

app.post('/api/chat/friend-request', (req, res) => {
  const { targetUserId, message } = req.body
  const request = {
    requestId: `fr_${Date.now()}`,
    targetUserId,
    message: message || '你好，我想添加你为好友',
    status: 'pending'
  }

  friendRequests.unshift(request)

  const systemChat = chats.find(c => c.type === 'system')
  if (systemChat) {
    systemChat.lastMsg = '您的账户实名认证已通过'
    systemChat.time = '10:30'
  }

  res.json({
    code: 200,
    data: request
  })
})

app.post('/api/chat/friend-request/:requestId/confirm', (req, res) => {
  const request = friendRequests.find((item) => item.requestId === req.params.requestId)
  if (!request) {
    return res.status(404).json({ code: 404, message: '好友申请不存在' })
  }

  request.status = 'accepted'

  const friend = friendDirectory.find((item) => String(item.id) === String(request.targetUserId))
  const nextChatId = chats.length + 1

  if (friend && !chats.find((item) => item.name === friend.nickname)) {
    chats.unshift({
      id: nextChatId,
      name: friend.nickname,
      lastMsg: '我们已经成为好友，开始聊天吧',
      time: '刚刚',
      type: 'user'
    })
    chatMessages[nextChatId] = generateMessages(nextChatId, 8)
  }

  res.json({
    code: 200,
    data: {
      requestId: request.requestId,
      status: 'accepted',
      chatId: chats[0]?.id || nextChatId,
      chatName: friend?.nickname || '新好友'
    }
  })
})

app.get('/api/chat/group-candidates', (req, res) => {
  res.json({
    code: 200,
    data: groupCandidates
  })
})

app.post('/api/chat/groups', (req, res) => {
  const { name, memberIds = [], notice } = req.body
  const nextChatId = chats.length + 1
  const members = groupCandidates.filter((item) => memberIds.includes(item.id))

  chats.unshift({
    id: nextChatId,
    name: name || '新建群聊',
    lastMsg: `${members.length} 位成员已加入群聊`,
    time: '刚刚',
    type: 'group'
  })

  chatMessages[nextChatId] = [
    {
      id: Date.now(),
      text: `群聊创建成功：${name || '新建群聊'}${notice ? `，群公告：${notice}` : ''}`,
      self: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]

  res.json({
    code: 200,
    data: {
      groupId: `grp_${nextChatId}`,
      chatId: nextChatId,
      name: name || '新建群聊',
      memberCount: members.length,
      status: 'created'
    }
  })
})

app.post('/api/chat/scan/parse', (req, res) => {
  const { code } = req.body
  const result = scanResultMap[code] || scanResultMap['url:activity-88']

  res.json({
    code: 200,
    data: result
  })
})

app.get('/api/chat/my-qr', (req, res) => {
  res.json({
    code: 200,
    data: {
      uid: 'U0001001',
      nickname: '黄金投资者_888',
      qrCode: createQrDataUri('金影子·我的二维码'),
      tips: ['扫码可添加我为好友', '当前为 mock 二维码展示']
    }
  })
})

app.get('/api/chat/transfer-targets', (req, res) => {
  const chatType = String(req.query.chatType || 'user')
  const chatTitle = String(req.query.chatTitle || '')

  if (chatType === 'group') {
    return res.json({
      code: 200,
      data: groupCandidates.map((item) => ({
        id: item.id,
        nickname: item.nickname,
        avatar: item.avatar,
        uid: item.uid
      }))
    })
  }

  const friend = friendDirectory.find((item) => item.nickname === chatTitle) || friendDirectory[0]
  return res.json({
    code: 200,
    data: friend ? [{
      id: friend.id,
      nickname: friend.nickname,
      avatar: friend.avatar,
      uid: friend.uid
    }] : []
  })
})

app.post('/api/chat/transfer', (req, res) => {
  const { chatId, amount, recipientName, note } = req.body
  const transferMessage = {
    id: Date.now(),
    type: 'transfer',
    self: true,
    amount: Number(amount) || 0,
    recipientName: recipientName || '收款方',
    note: note || '',
    status: '转账成功',
    text: `向 ${recipientName || '收款方'} 转账 ¥${Number(amount || 0).toFixed(2)}`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!chatMessages[chatId]) {
    chatMessages[chatId] = []
  }
  chatMessages[chatId].push(transferMessage)

  const chat = chats.find((item) => String(item.id) === String(chatId))
  if (chat) {
    chat.lastMsg = transferMessage.text
    chat.time = transferMessage.time
  }

  res.json({
    code: 200,
    data: transferMessage
  })
})

// 6. 交易 (Trade)
const orders = [] // 清空死数据，由用户操作产生

app.get('/api/trade/orders', (req, res) => {
  res.json({
    code: 200,
    data: orders
  })
})

app.post('/api/trade/order', async (req, res) => {
  const { assetId, type, quantity } = req.body
  
  const assetMap = {
    'AU9999': { name: '现货黄金' },
    'AG9999': { name: '现货白银' },
    'USDX': { name: '美指' },
    'OIL': { name: '原油' }
  }
  
  const asset = assetMap[assetId] || assetMap['AU9999']
  let currentPrice = 0

  try {
    currentPrice = await resolveAssetPrice(assetId)
  } catch (error) {
    return sendUpstreamError(res, error, '实时成交价获取失败')
  }
  
  const newOrder = {
    id: orders.length + 1,
    type: type === 'buy' ? '买入' : '卖出',
    name: asset.name,
    price: currentPrice.toFixed(2),
    quantity,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  orders.unshift(newOrder)
  
  setTimeout(() => {
    res.json({
      code: 200,
      message: '下单成功',
      data: newOrder
    })
  }, 800)
})

// 7. 行情图表 (Market Chart)
app.get('/api/market/kline', async (req, res) => {
  const { period = '1m', asset = 'AU9999' } = req.query
  const data = []

  let basePrice = 0
  try {
    basePrice = await resolveAssetPrice(asset)
  } catch (error) {
    return sendUpstreamError(res, error, 'K 线基准价获取失败')
  }

  const now = Date.now()
  
  // 根据周期决定生成多少数据点
  let count = 50
  let interval = 60000 // 1分钟
  
  if (period === 'daily') {
    count = 30
    interval = 24 * 3600000
  } else if (period === 'weekly') {
    count = 20
    interval = 7 * 24 * 3600000
  } else if (period === 'monthly') {
    count = 12
    interval = 30 * 24 * 3600000
  } else if (period === 'quarterly') {
    count = 8
    interval = 90 * 24 * 3600000
  } else if (period === 'yearly') {
    count = 5
    interval = 365 * 24 * 3600000
  }

  for (let i = 0; i < count; i++) {
    const volatility = period === '1m' ? basePrice * 0.003 : basePrice * 0.03 // 周期越大波动越大，且波动相对于基准价
    const open = basePrice + (Math.random() - 0.5) * volatility
    const close = open + (Math.random() - 0.5) * (volatility * 0.8)
    const high = Math.max(open, close) + Math.random() * (volatility * 0.3)
    const low = Math.min(open, close) - Math.random() * (volatility * 0.3)
    data.push({
      timestamp: now - (count - i) * interval,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 10000) + 500
    })
    basePrice = close
  }
  res.json({
    code: 200,
    data
  })
})

// 8. 用户信息 (User Profile)
app.get('/api/user/profile', async (req, res) => {
  try {
    const [goldPricePerGram, silverPricePerGram] = await Promise.all([
      resolveAssetPrice('AU9999'),
      resolveAssetPrice('AG9999')
    ])

    const goldPositions = buildProfilePositions(profilePositionTemplates.gold, goldPricePerGram)
    const silverPositions = buildProfilePositions(profilePositionTemplates.silver, silverPricePerGram)
    const marketValue = calculatePositionsValue(goldPositions) + calculatePositionsValue(silverPositions)
    const totalAssets = profileBaseBalance + marketValue

    res.json({
      code: 200,
      data: {
        id: '8829103',
        username: '黄金投资者_888',
        nickname: '黄金投资者_888',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GoldInvestor',
        level: 'Vip 3',
        fee: '0.2%',
        assets: [
          { key: 'profile.assets.total', value: formatMoney(totalAssets), unit: 'CNY' },
          { key: 'profile.assets.balance', value: formatMoney(profileBaseBalance), unit: 'CNY' },
          { key: 'profile.assets.marketValue', value: formatMoney(marketValue), unit: 'CNY' },
          { key: 'profile.assets.yesterdayProfit', value: `+${formatMoney(profileYesterdayProfit)}`, unit: 'CNY', trend: 'up' },
          { key: 'profile.assets.accumulatedProfit', value: `+${formatMoney(profileAccumulatedProfit)}`, unit: 'CNY', trend: 'up' },
          // Profile 页面“暂定资产”展示为锁定资产（mock 默认 0）
          { key: 'profile.tempAssets', value: formatMoney(0), unit: 'CNY' },
        ],
        goldPositions,
        silverPositions
      }
    })
  } catch (error) {
    return sendUpstreamError(res, error, '用户金银持仓现价获取失败')
  }
})

app.post('/api/wallet/recharge', (req, res) => {
  const { channel, amount } = req.body
  const rechargeAmount = Number(amount || 0)

  if (!['wechat', 'alipay', 'bankcard'].includes(channel)) {
    return res.status(400).json({ code: 400, message: '充值渠道不支持' })
  }

  if (!Number.isFinite(rechargeAmount) || rechargeAmount <= 0) {
    return res.status(400).json({ code: 400, message: '充值金额不合法' })
  }

  const orderId = `re_${Date.now()}`
  const order = {
    orderId,
    channel,
    amount: rechargeAmount,
    status: 'pending',
    payHint: '请完成支付后点击“我已完成付款”',
  }
  rechargeOrders.set(orderId, order)

  res.json({
    code: 200,
    data: order
  })
})

app.post('/api/wallet/recharge/:orderId/confirm', (req, res) => {
  const order = rechargeOrders.get(req.params.orderId)
  if (!order) {
    return res.status(404).json({ code: 404, message: '充值订单不存在' })
  }

  if (order.status !== 'paid') {
    order.status = 'paid'
    profileBaseBalance += Number(order.amount || 0)
  }

  res.json({
    code: 200,
    data: {
      orderId: order.orderId,
      status: order.status,
      amount: order.amount,
      channel: order.channel
    }
  })
})

app.post('/api/wallet/withdraw/send-sms', (req, res) => {
  const { amount } = req.body
  const withdrawAmount = Number(amount || 0)

  if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ code: 400, message: '提现金额不合法' })
  }

  if (withdrawAmount > profileBaseBalance) {
    return res.status(400).json({ code: 400, message: '余额不足，无法提现' })
  }

  const smsToken = `sms_${Date.now()}`
  const smsCode = '123456'
  withdrawSmsTokens.set(smsToken, {
    code: smsCode,
    createdAt: Date.now(),
    expireSeconds: 60
  })

  res.json({
    code: 200,
    data: {
      smsToken,
      maskedMobile: '138****1024',
      expireSeconds: 60
    }
  })
})

app.post('/api/wallet/withdraw', (req, res) => {
  const { channel, amount, smsCode, smsToken } = req.body
  const withdrawAmount = Number(amount || 0)

  if (!['wechat', 'alipay', 'bankcard'].includes(channel)) {
    return res.status(400).json({ code: 400, message: '提现渠道不支持' })
  }

  if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ code: 400, message: '提现金额不合法' })
  }

  if (withdrawAmount > profileBaseBalance) {
    return res.status(400).json({ code: 400, message: '余额不足，无法提现' })
  }

  const smsRecord = withdrawSmsTokens.get(String(smsToken))
  if (!smsRecord) {
    return res.status(400).json({ code: 400, message: '验证码已失效，请重新获取' })
  }

  if (String(smsRecord.code) !== String(smsCode)) {
    return res.status(400).json({ code: 400, message: '短信验证码错误' })
  }

  profileBaseBalance -= withdrawAmount
  withdrawSmsTokens.delete(String(smsToken))

  res.json({
    code: 200,
    data: {
      withdrawId: `wd_${Date.now()}`,
      status: 'processing',
      amount: withdrawAmount,
      channel,
      message: '提现申请已提交，预计 1-24 小时到账'
    }
  })
})

// 9. 热门活动 (Activities/Banners)
const activities = [
  { 
    id: 1, 
    title: '黄金开户送豪礼', 
    image: 'https://images.unsplash.com/photo-1550565118-3a14e8d0386f?q=80&w=800&auto=format&fit=crop',
    content: '<p>欢迎参加金影子黄金开户活动！即日起，凡是在平台完成实名认证并开立黄金账户的用户，均可获得价值 188 元的实物金券一张。</p><p>活动详情：用户完成注册 -> 实名认证 -> 开通交易权限。奖励将在 24 小时内发放到您的账户中。</p>'
  },
  { 
    id: 2, 
    title: '邀请好友双重礼', 
    image: 'https://images.unsplash.com/photo-1550565118-3a14e8d0386f?q=80&w=800&auto=format&fit=crop',
    content: '<p>独乐乐不如众乐乐。现在邀请您的好友加入金影子，您和好友均可获得丰厚奖励。</p><p>每成功邀请一位好友完成首笔交易，您将获得 10 积分奖励，好友可获得 5 积分。积分可用于兑换商城礼品或抵扣交易手续费。</p>'
  },
  { 
    id: 3, 
    title: '行情分析大师课', 
    image: 'https://images.unsplash.com/photo-1550565118-3a14e8d0386f?q=80&w=800&auto=format&fit=crop',
    content: '<p>想要看透金价走势？加入我们的“金影子大师课”。本课程由资深分析师主讲，带您深度解析 K 线技术、宏观经济对金价的影响。</p><p>每周三晚 20:00，不见不散。</p>'
  }
]

app.get('/api/activities', (req, res) => {
  res.json({
    code: 200,
    data: activities.map(a => ({ id: a.id, title: a.title, image: a.image }))
  })
})

app.get('/api/activities/:id', (req, res) => {
  const { id } = req.params
  const activity = activities.find(a => a.id === parseInt(id))
  if (activity) {
    res.json({
      code: 200,
      data: {
        ...activity,
        date: '2026-02-14',
        views: 888,
        author: '官方活动组'
      }
    })
  } else {
    res.status(404).json({ message: '活动不存在' })
  }
})

app.get('/api/admin/dashboard', (req, res) => {
  res.json({
    code: 200,
    data: dashboardData
  })
})

app.get('/api/admin/users', (req, res) => {
  res.json({
    code: 200,
    data: usersData
  })
})

app.get('/api/admin/funds', (req, res) => {
  res.json({
    code: 200,
    data: fundsData
  })
})

app.get('/api/admin/trades', (req, res) => {
  res.json({
    code: 200,
    data: tradesData
  })
})

app.get('/api/admin/leaderboard', (req, res) => {
  res.json({
    code: 200,
    data: leaderboardData
  })
})

app.get('/api/admin/risk', (req, res) => {
  res.json({
    code: 200,
    data: riskData
  })
})

app.get('/api/admin/audit', (req, res) => {
  res.json({
    code: 200,
    data: auditData
  })
})

app.get('/api/admin/reports', (req, res) => {
  res.json({
    code: 200,
    data: reportsData
  })
})

// 10. 用户端排行榜 - 金字塔6排数据
app.get('/api/public/leaderboard', (req, res) => {
  const leaderboardData = [
    { rank: 1, sequenceNo: 1, nickname: '黄金大佬', goldGrams: 2500.00, totalAsset: 1250000 },
    { rank: 2, sequenceNo: 2, nickname: '白银猎手', goldGrams: 1800.00, totalAsset: 900000 },
    { rank: 3, sequenceNo: 3, nickname: '稳健投资者', goldGrams: 1200.00, totalAsset: 600000 },
    { rank: 4, sequenceNo: 4, nickname: '金市观察者', goldGrams: 800.00, totalAsset: 400000 },
    { rank: 5, sequenceNo: 5, nickname: '财富积累者', goldGrams: 500.00, totalAsset: 250000 },
    { rank: 6, sequenceNo: 6, nickname: '理财新手', goldGrams: 200.00, totalAsset: 100000 }
  ]
  res.json({
    code: 200,
    data: { items: leaderboardData }
  })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Mock server running at http://0.0.0.0:${port}`)
})
