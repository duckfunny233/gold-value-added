export const cloneData = (value) => JSON.parse(JSON.stringify(value))

export const marketPricesFallback = [
  { id: 'AU9999', name: '黄金9999 Au99.99', price: '1046.20', change: '+0.12%', up: true, unit: '元/克' },
  { id: 'AUTD', name: '黄金延期 Au(T+D)', price: '1048.50', change: '+0.08%', up: true, unit: '元/克' },
  { id: 'AG9999', name: '白银9999 Ag99.99', price: '16.65', change: '+0.32%', up: true, unit: '元/克' },
  { id: 'AGTD', name: '白银延期 Ag(T+D)', price: '18.83', change: '+0.27%', up: true, unit: '元/克' },
  { id: 'LME_CU', name: '伦敦铜 LME', price: '0.0860', change: '+0.14%', up: true, unit: '元/克' },
  { id: 'LME_AL', name: '伦敦铝 LME', price: '0.0238', change: '-0.11%', up: false, unit: '元/克' },
  { id: 'SH_CU', name: '上海铜 沪铜主力', price: '0.0978', change: '+0.09%', up: true, unit: '元/克' },
  { id: 'SH_AL', name: '上海铝 沪铝主力', price: '0.0195', change: '-0.06%', up: false, unit: '元/克' },
  { id: 'SH_ZN', name: '上海锌 沪锌主力', price: '0.0210', change: '+0.07%', up: true, unit: '元/克' },
  { id: 'SH_NI', name: '上海镍 沪镍主力', price: '0.1350', change: '+0.10%', up: true, unit: '元/克' },
  { id: 'SH_RB', name: '螺纹钢 沪螺纹主力', price: '0.003093', change: '-0.03%', up: false, unit: '元/克' },
  { id: 'SH_J', name: '焦炭 沪焦炭主力', price: '0.002200', change: '+0.02%', up: true, unit: '元/克' },
  { id: 'OIL', name: '美原油 WTI', price: '62.30', change: '+0.25%', up: true, unit: '美元/桶' },
  { id: 'BRENT', name: '布伦特原油', price: '66.80', change: '+0.21%', up: true, unit: '美元/桶' },
  { id: 'NG', name: '天然气 NYMEX', price: '2.85', change: '-0.15%', up: false, unit: '美元/MMBtu' },
  { id: 'USD_CNY', name: '美元兑人民币', price: '6.8305', change: '+0.01%', up: true, unit: '汇率' },
  { id: 'EUR_USD', name: '欧元兑美元', price: '1.1725', change: '-0.02%', up: false, unit: '汇率' },
  { id: 'GBP_USD', name: '英镑兑美元', price: '1.3463', change: '+0.03%', up: true, unit: '汇率' },
  { id: 'USD_JPY', name: '美元兑日元', price: '148.20', change: '+0.04%', up: true, unit: '汇率' },
  { id: 'USDX', name: '美元指数', price: '98.645', change: '+0.05%', up: true, unit: '点' },
  { id: 'SSE', name: '上证指数', price: '3986.22', change: '+0.40%', up: true, unit: '点' },
  { id: 'SZSE', name: '深证成指', price: '14309.47', change: '+0.35%', up: true, unit: '点' },
  { id: 'CYB', name: '创业板指', price: '3448.79', change: '+0.28%', up: true, unit: '点' },
  { id: 'NASDAQ', name: '纳斯达克', price: '19645.77', change: '+0.22%', up: true, unit: '点' },
  { id: 'DJI', name: '道琼斯', price: '39800.00', change: '+0.18%', up: true, unit: '点' },
  { id: 'SPX', name: '标普500', price: '5280.00', change: '+0.16%', up: true, unit: '点' },
]

export const marketPeriodsFallback = [
  { label: 'market.timeShare', value: '1m', type: 'area' },
  { label: 'market.hourlyK', value: 'hourly', type: 'candle' },
  { label: 'market.dailyK', value: 'daily', type: 'candle' },
  { label: 'market.weeklyK', value: 'weekly', type: 'candle' },
  { label: 'market.monthlyK', value: 'monthly', type: 'candle' },
  { label: 'market.quarterlyK', value: 'quarterly', type: 'candle' },
  { label: 'market.yearlyK', value: 'yearly', type: 'candle' },
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
  realNameVerified: true,
  assets: [
    { key: 'profile.assets.total', value: '1,250,000.00', unit: 'CNY' },
    { key: 'profile.assets.balance', value: '85,400.00', unit: 'CNY' },
    { key: 'profile.assets.marketValue', value: '1,154,600.00', unit: 'CNY' },
    { key: 'profile.assets.yesterdayProfit', value: '+12,450.00', unit: 'CNY', trend: 'up' },
    { key: 'profile.assets.accumulatedProfit', value: '+450,200.00', unit: 'CNY', trend: 'up' },
  ],
  goldPositions: [
    { level: '影子金币', weight: '10g', price: '10,462.00', count: 2, bgImage: '/影子金币10g黄金.png' },
    { level: '金叶币', weight: '50g', price: '52,310.00', count: 1, bgImage: '/金叶币50g黄金.png' },
    { level: '龙金币', weight: '100g', price: '104,620.00', count: 1, bgImage: '/龙币100g黄金.png' },
    { level: '黄金条', weight: '1000g', price: '1,046,200.00', count: 0, bgImage: '/黄金条1000g黄金.png' },
    { level: '黄金砖', weight: '5000g', price: '5,231,000.00', count: 0, bgImage: '/黄金砖5000g黄金.png' },
  ],
  silverPositions: [
    { level: '影子银币', weight: '10g', price: '188.30', count: 10, bgImage: '/影子金币10g黄金.png' },
    { level: '银叶币', weight: '50g', price: '941.50', count: 3, bgImage: '/金叶币50g白银.png' },
    { level: '龙银币', weight: '100g', price: '1,883.00', count: 1, bgImage: '/龙币100g白银.png' },
    { level: '白银条', weight: '1000g', price: '18,830.00', count: 0, bgImage: '/黄金条1000g白银.png' },
    { level: '白银砖', weight: '5000g', price: '94,150.00', count: 0, bgImage: '/黄金砖5000g白银.png' },
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
