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

// 准备大量模拟数据 (与 handlers.js 保持一致)
const allNews = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  title: `[第${i + 1}条] ${['全球金价波动', '平台安全升级', '市场深度分析', '黄金增值指南'][i % 4]} - 2026行业新动态`,
  date: `2026-02-${Math.max(1, 13 - Math.floor(i/2)).toString().padStart(2, '0')}`,
  summary: '这是新闻的简短描述，用于展示分页效果。黄金作为避险资产，在当前市场环境下表现稳健...',
  // 模拟只有部分新闻有略缩图 (每3条中有一条没有图)
  thumbnail: i % 3 === 0 ? '' : `https://picsum.photos/seed/news${i}/200/200`
}))

// 1. 获取新闻列表 (支持分页)
app.get('/api/news', (req, res) => {
  const page = parseInt(req.query.page || '1')
  const limit = parseInt(req.query.limit || '5')
  
  const start = (page - 1) * limit
  const end = start + limit
  const items = allNews.slice(start, end)

  setTimeout(() => {
    res.json({
      code: 200,
      data: {
        items,
        total: allNews.length,
        page,
        limit,
        totalPages: Math.ceil(allNews.length / limit)
      }
    })
  }, 600)
})

// 1.1 获取新闻详情
app.get('/api/news/:id', (req, res) => {
  const { id } = req.params
  const news = allNews.find(n => n.id === parseInt(id))
  
  if (!news) {
    return res.status(404).json({ message: '新闻不存在' })
  }

  setTimeout(() => {
    // 根据标题关键字生成不同的正文内容
    let dynamicContent = ''
    if (news.title.includes('金价')) {
      dynamicContent = `
        <p class="mb-4">【金影子快讯】今日现货黄金市场表现活跃，受到地缘局势及美联储最新政策声明的影响，金价在早盘阶段一度冲高至关键压力位。分析师认为，当前基本面支撑依然强劲。</p>
        <p class="mb-4">具体来看，多国央行近期持续披露增持黄金储备的计划，这为金价提供了坚实的下方支撑。投资者普遍关注即将公布的非农就业数据，预计将引发新一轮波动。</p>
        <p class="mb-4">操作策略方面，建议短线交易者关注支撑位附近的买入机会，中长期投资者可继续持有实物金或黄金凭证。</p>
      `
    } else if (news.title.includes('安全')) {
      dynamicContent = `
        <p class="mb-4">为了提供更极致的交易体验，金影子平台于今日凌晨完成了底层加密算法的全面升级。本次升级涉及多重签名校验、冷热钱包隔离机制以及毫秒级风险预警系统。</p>
        <p class="mb-4">平台技术负责人表示：“资产安全是我们的生命线。通过此次升级，我们进一步巩固了防御体系，能够更从容地应对各种复杂的网络攻击环境。”</p>
        <p class="mb-4">用户无需任何操作，所有升级流程已由后台自动完成，充值与提现功能运行平稳。</p>
      `
    } else if (news.title.includes('分析')) {
      dynamicContent = `
        <p class="mb-4">宏观经济分析报告指出，当前全球流动性环境正发生深刻变化。在通胀预期波动与增长压力并存的背景下，大宗商品尤其是贵金属的资产配置价值进一步凸显。</p>
        <p class="mb-4">报告详细拆解了过去三个季度的市场数据，显示黄金与传统风险资产的相关性正在降低。这意味着在投资组合中加入黄金，能有效降低整体回撤水平。</p>
        <p class="mb-4">专家建议，在资产配置中应保持10%-15%的黄金权重，以应对潜在的市场不确定性。</p>
      `
    } else {
      dynamicContent = `
        <p class="mb-4">欢迎阅读黄金增值指南。作为投资者，理解复利效应与黄金定投的逻辑至关重要。黄金不仅是避险工具，更是跨越经济周期的财富存储器。</p>
        <p class="mb-4">本指南将从入门知识出发，为您解析如何通过小额定投的方式，逐步建立起属于自己的“黄金护城河”。</p>
        <p class="mb-4">我们将持续更新更多实操案例，助您在波动的市场中保持定力，实现财富的稳健增值。</p>
      `
    }

    res.json({
      code: 200,
      data: {
        ...news,
        views: Math.floor(Math.random() * 2000) + 500,
        author: '金影子研究院',
        // 详情页主图模拟 (ID为偶数时提供图)
        image: parseInt(id) % 2 === 0 ? `https://picsum.photos/seed/detail${id}/800/400` : '',
        content: dynamicContent
      }
    })
  }, 300)
})

// 2. 实时行情 (Market Prices)
const marketData = {
  AU9999: { name: '现货黄金', price: 2654.40, base: 2650 },
  AG9999: { name: '现货白银', price: 31.22, base: 31 },
  USDX: { name: '美指', price: 104.15, base: 104 },
  OIL: { name: '原油', price: 78.50, base: 78 }
}

app.get('/api/market/prices', (req, res) => {
  const result = Object.entries(marketData).map(([id, item]) => {
    // 模拟价格微小波动
    const volatility = item.price * 0.0005 
    const change = (Math.random() - 0.5) * volatility
    item.price = parseFloat((item.price + change).toFixed(2))
    
    const percentChange = ((item.price - item.base) / item.base * 100).toFixed(2)
    
    return {
      id,
      name: item.name,
      price: item.price.toFixed(2),
      change: (percentChange > 0 ? '+' : '') + percentChange + '%',
      up: percentChange >= 0
    }
  })
  res.json({
    code: 200,
    data: result
  })
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

// 6. 交易 (Trade)
const orders = [] // 清空死数据，由用户操作产生

app.get('/api/trade/orders', (req, res) => {
  res.json({
    code: 200,
    data: orders
  })
})

app.post('/api/trade/order', (req, res) => {
  const { assetId, type, quantity } = req.body
  
  // 根据 assetId 匹配名称和基准价
  const assetMap = {
    'AU9999': { name: '现货黄金', basePrice: 485 },
    'AG9999': { name: '现货白银', basePrice: 31 },
    'USDX': { name: '美指', basePrice: 104 },
    'OIL': { name: '原油', basePrice: 78 }
  }
  
  const asset = assetMap[assetId] || assetMap['AU9999']
  
  const newOrder = {
    id: orders.length + 1,
    type: type === 'buy' ? '买入' : '卖出',
    name: asset.name,
    price: (asset.basePrice + Math.random() * (asset.basePrice * 0.01)).toFixed(2),
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
app.get('/api/market/kline', (req, res) => {
  const { period = '1m', asset = 'AU9999' } = req.query
  const data = []
  
  // 根据品种决定基准价格
  const assetBasePrices = {
    'AU9999': 485.25,
    'AG9999': 31.50,
    'USDX': 104.20,
    'OIL': 78.80
  }
  let basePrice = assetBasePrices[asset] || 485.25

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
app.get('/api/user/profile', (req, res) => {
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
        { key: 'profile.assets.total', value: '1,250,000.00', unit: 'CNY' },
        { key: 'profile.assets.balance', value: '85,400.00', unit: 'CNY' },
        { key: 'profile.assets.marketValue', value: '1,154,600.00', unit: 'CNY' },
        { key: 'profile.assets.yesterdayProfit', value: '+12,450.00', unit: 'CNY', trend: 'up' },
        { key: 'profile.assets.accumulatedProfit', value: '+450,200.00', unit: 'CNY', trend: 'up' },
      ],
      goldPositions: [
        { level: '影子金币', weight: '10g', price: '5,652.00', count: 2, bgImage: '/images/金影子金币.jpg' },
        { level: '影子金币', weight: '50g', price: '28,260.00', count: 1, bgImage: '/images/金叶币.jpg' },
        { level: '影子金币', weight: '500g', price: '56,520.00', count: 0, bgImage: '/images/影子金币.jpg' },
        { level: '黄金条', weight: '5000g', price: '282,600.00', count: 0, bgImage: '/images/黄金条.jpg' },
        { level: '黄金砖', weight: '50000g', price: '565,200.00', count: 0, bgImage: '/images/黄金砖.jpg' },
      ],
      silverPositions: [
        { level: '影子金币', weight: '10g', price: '820.00', count: 10, bgImage: '/images/金影子金币.jpg' },
        { level: '影子金币', weight: '50g', price: '4,100.00', count: 3, bgImage: '/images/金叶币_银.jpg' },
        { level: '影子金币', weight: '500g', price: '8,200.00', count: 1, bgImage: '/images/影子金币_银.jpg' },
        { level: '黄金条', weight: '5000g', price: '41,000.00', count: 0, bgImage: '/images/黄金条_银.jpg' },
        { level: '黄金砖', weight: '50000g', price: '82,000.00', count: 0, bgImage: '/images/黄金砖_银.jpg' },
      ]
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

app.listen(port, '0.0.0.0', () => {
  console.log(`Mock server running at http://0.0.0.0:${port}`)
})
