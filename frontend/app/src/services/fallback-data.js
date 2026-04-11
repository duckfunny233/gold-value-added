export const cloneData = (value) => JSON.parse(JSON.stringify(value))

export const marketPricesFallback = [
  { id: 'AU9999', name: '现货黄金', price: '2649.51', change: '-0.02%', up: true },
  { id: 'AG9999', name: '现货白银', price: '31.18', change: '+0.58%', up: true },
  { id: 'USDX', name: '美指', price: '104.08', change: '+0.08%', up: true },
  { id: 'OIL', name: '原油', price: '78.52', change: '+0.67%', up: true },
]

export const marketPeriodsFallback = [
  { label: 'market.timeShare', value: '1m', type: 'area' },
  { label: 'market.dailyK', value: 'daily', type: 'candle' },
  { label: 'market.weeklyK', value: 'weekly', type: 'candle' },
  { label: 'market.monthlyK', value: 'monthly', type: 'candle' },
]

export const buildKLineFallback = () => {
  const points = []
  const start = 482.2
  const now = Date.now()
  let current = start

  for (let index = 0; index < 32; index += 1) {
    const drift = [0.18, -0.06, 0.22, -0.04, 0.12, 0.08][index % 6]
    const open = current
    const close = Number((current + drift).toFixed(2))
    const high = Number((Math.max(open, close) + 0.22).toFixed(2))
    const low = Number((Math.min(open, close) - 0.18).toFixed(2))
    points.push({
      timestamp: now - (32 - index) * 60000,
      open: Number(open.toFixed(2)),
      high,
      low,
      close,
      volume: 1000 + index * 27,
    })
    current = close
  }

  return points
}

export const profileFallback = {
  id: '8829103',
  username: '黄金投资者_888',
  nickname: '黄金投资者_888',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=GoldInvestor',
  fee: '--',
  assets: [
    { key: 'profile.assets.total', value: '1,250,000.00', unit: 'CNY' },
    { key: 'profile.assets.balance', value: '85,400.00', unit: 'CNY' },
    { key: 'profile.assets.marketValue', value: '1,154,600.00', unit: 'CNY' },
    { key: 'profile.assets.yesterdayProfit', value: '+12,450.00', unit: 'CNY', trend: 'up' },
    { key: 'profile.assets.accumulatedProfit', value: '+450,200.00', unit: 'CNY', trend: 'up' },
  ],
  goldPositions: [
    { level: '影子金币', weight: '10g', price: '5,652.00', count: 2, bgImage: '/金影子金币.jpg' },
    { level: '影子金币', weight: '50g', price: '28,260.00', count: 1, bgImage: '/金叶币.jpg' },
    { level: '黄金条', weight: '5000g', price: '282,600.00', count: 0, bgImage: '/黄金条.jpg' },
  ],
  silverPositions: [
    { level: '影子金币', weight: '10g', price: '820.00', count: 10, bgImage: '/金影子金币.jpg' },
    { level: '影子金币', weight: '50g', price: '4,100.00', count: 3, bgImage: '/金叶币_银.jpg' },
    { level: '黄金条', weight: '5000g', price: '41,000.00', count: 0, bgImage: '/黄金条_银.jpg' },
  ],
}

export const activitiesFallback = [
  {
    id: 1,
    title: '黄金开户送豪礼',
    image: 'https://images.unsplash.com/photo-1550565118-3a14e8d0386f?q=80&w=800&auto=format&fit=crop',
  },
  {
    id: 2,
    title: '邀请好友双重礼',
    image: 'https://images.unsplash.com/photo-1550565118-3a14e8d0386f?q=80&w=800&auto=format&fit=crop',
  },
]

export const buildActivityDetailFallback = (id) => ({
  id: Number(id),
  title: id === '2' ? '邀请好友双重礼' : '黄金开户送豪礼',
  date: '2026-02-14',
  views: 888,
  author: '官方活动组',
  image: 'https://images.unsplash.com/photo-1550565118-3a14e8d0386f?q=80&w=800&auto=format&fit=crop',
  content: '<p>这是活动详情的本地兜底内容，用于在接口不可用时保持页面可读。</p>',
})

export const newsListFallback = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  title: `[第${index + 1}条] ${['全球金价波动', '平台安全升级', '市场深度分析'][index % 3]} - 2026行业新动态`,
  date: `2026-02-${String(13 - index).padStart(2, '0')}`,
  summary: '这是新闻的简短描述，用于展示列表内容和跳转效果。',
  thumbnail: index % 2 === 0 ? `https://picsum.photos/seed/news${index}/200/200` : '',
}))

export const buildNewsDetailFallback = (id) => {
  const news = newsListFallback.find((item) => String(item.id) === String(id)) || newsListFallback[0]
  return {
    ...news,
    views: 1260,
    author: '金影子研究院',
    image: news.thumbnail || 'https://picsum.photos/seed/detail-fallback/800/400',
    content: '<p>这是资讯详情的本地兜底内容，用于在接口不可用时维持页面完整展示。</p><p>页面样式会与原始设计保持一致。</p>',
  }
}

export const tradeOrdersFallback = []
