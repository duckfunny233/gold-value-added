import { API_BASE, apiFetch } from '../utils/request'
import {
  buildKLineFallback,
  cloneData,
  marketPeriodsFallback,
  marketPricesFallback,
} from './fallback-data'

const DEFAULT_TRADING_WINDOWS = [
  {
    dayIndexes: [1, 2, 3, 4, 5],
    label: '上午盘 09:00 - 11:30',
    startMinutes: 9 * 60,
    endMinutes: 11 * 60 + 30,
  },
  {
    dayIndexes: [1, 2, 3, 4, 5],
    label: '下午盘 13:30 - 21:00',
    startMinutes: 13 * 60 + 30,
    endMinutes: 21 * 60,
  },
]

const INSTRUMENT_CATALOG = [
  { id: 'AU9999', name: '黄金9999 Au99.99', basePrice: 1046.2, decimals: 2, unit: '元/克', volatility: 0.0020, source: 'external' },
  { id: 'AUTD', name: '黄金延期 Au(T+D)', basePrice: 1048.5, decimals: 2, unit: '元/克', volatility: 0.0018, source: 'local' },
  { id: 'AG9999', name: '白银9999 Ag99.99', basePrice: 16.65, decimals: 2, unit: '元/克', volatility: 0.0035, source: 'external' },
  { id: 'AGTD', name: '白银延期 Ag(T+D)', basePrice: 18.83, decimals: 2, unit: '元/克', volatility: 0.0032, source: 'local' },

  { id: 'LME_CU', name: '伦敦铜 LME', basePrice: 0.086, decimals: 4, unit: '元/克', volatility: 0.0040, source: 'local' },
  { id: 'LME_AL', name: '伦敦铝 LME', basePrice: 0.0238, decimals: 4, unit: '元/克', volatility: 0.0040, source: 'local' },
  { id: 'SH_CU', name: '上海铜 沪铜主力', basePrice: 0.0978, decimals: 4, unit: '元/克', volatility: 0.0038, source: 'local' },
  { id: 'SH_AL', name: '上海铝 沪铝主力', basePrice: 0.0195, decimals: 4, unit: '元/克', volatility: 0.0038, source: 'local' },
  { id: 'SH_ZN', name: '上海锌 沪锌主力', basePrice: 0.021, decimals: 4, unit: '元/克', volatility: 0.0038, source: 'local' },
  { id: 'SH_NI', name: '上海镍 沪镍主力', basePrice: 0.135, decimals: 4, unit: '元/克', volatility: 0.0045, source: 'local' },
  { id: 'SH_RB', name: '螺纹钢 沪螺纹主力', basePrice: 0.003093, decimals: 6, unit: '元/克', volatility: 0.0045, source: 'local' },
  { id: 'SH_J', name: '焦炭 沪焦炭主力', basePrice: 0.0022, decimals: 6, unit: '元/克', volatility: 0.0045, source: 'local' },

  { id: 'OIL', name: '美原油 WTI', basePrice: 62.3, decimals: 2, unit: '美元/桶', volatility: 0.0030, source: 'external' },
  { id: 'BRENT', name: '布伦特原油', basePrice: 66.8, decimals: 2, unit: '美元/桶', volatility: 0.0030, source: 'local' },
  { id: 'NG', name: '天然气 NYMEX', basePrice: 2.85, decimals: 2, unit: '美元/MMBtu', volatility: 0.0040, source: 'local' },

  { id: 'USD_CNY', name: '美元兑人民币', basePrice: 6.8305, decimals: 4, unit: '汇率', volatility: 0.0010, source: 'local' },
  { id: 'EUR_USD', name: '欧元兑美元', basePrice: 1.1725, decimals: 4, unit: '汇率', volatility: 0.0012, source: 'local' },
  { id: 'GBP_USD', name: '英镑兑美元', basePrice: 1.3463, decimals: 4, unit: '汇率', volatility: 0.0012, source: 'local' },
  { id: 'USD_JPY', name: '美元兑日元', basePrice: 148.2, decimals: 2, unit: '汇率', volatility: 0.0012, source: 'local' },
  { id: 'USDX', name: '美元指数', basePrice: 98.645, decimals: 3, unit: '点', volatility: 0.0015, source: 'external' },

  { id: 'SSE', name: '上证指数', basePrice: 3986.22, decimals: 2, unit: '点', volatility: 0.0020, source: 'local' },
  { id: 'SZSE', name: '深证成指', basePrice: 14309.47, decimals: 2, unit: '点', volatility: 0.0020, source: 'local' },
  { id: 'CYB', name: '创业板指', basePrice: 3448.79, decimals: 2, unit: '点', volatility: 0.0022, source: 'local' },
  { id: 'NASDAQ', name: '纳斯达克', basePrice: 19645.77, decimals: 2, unit: '点', volatility: 0.0022, source: 'local' },
  { id: 'DJI', name: '道琼斯', basePrice: 39800, decimals: 2, unit: '点', volatility: 0.0020, source: 'local' },
  { id: 'SPX', name: '标普500', basePrice: 5280, decimals: 2, unit: '点', volatility: 0.0020, source: 'local' },
]

const EXTERNAL_IDS = new Set(['AU9999', 'AG9999', 'OIL', 'USDX'])
const localQuoteState = new Map()
let cachedTradingWindows = DEFAULT_TRADING_WINDOWS
let hasBootstrappedTradingWindows = false
const EXPECTED_PERIOD_VALUES = ['1m', 'daily', 'weekly', 'monthly']

const pad = (value) => String(value).padStart(2, '0')
const formatPrice = (value, decimals) => Number(value).toFixed(decimals)

const formatDateTime = (date) => {
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  return `${month}-${day} ${hour}:${minute}`
}

const getMinutesOfDay = (date) => date.getHours() * 60 + date.getMinutes()

const normalizeRemoteQuote = (item, catalog) => {
  const priceValue = Number(item?.price)
  const safePrice = Number.isFinite(priceValue) ? priceValue : catalog.basePrice
  const change = typeof item?.change === 'string' ? item.change : '+0.00%'
  const up = typeof item?.up === 'boolean' ? item.up : !change.startsWith('-')
  return {
    id: catalog.id,
    name: catalog.name,
    price: formatPrice(safePrice, catalog.decimals),
    change,
    up,
    unit: catalog.unit,
    source: 'external',
  }
}

const buildLocalQuote = (catalog) => {
  const previous = localQuoteState.has(catalog.id) ? localQuoteState.get(catalog.id) : catalog.basePrice
  const drift = (Math.random() - 0.5) * (catalog.basePrice * catalog.volatility)
  const next = Math.max(catalog.basePrice * 0.4, previous + drift)
  localQuoteState.set(catalog.id, next)

  const changePct = ((next - catalog.basePrice) / catalog.basePrice) * 100
  return {
    id: catalog.id,
    name: catalog.name,
    price: formatPrice(next, catalog.decimals),
    change: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
    up: changePct >= 0,
    unit: catalog.unit,
    source: 'local',
  }
}

const getNextOpenTime = (windows, now) => {
  for (let offset = 0; offset < 7; offset += 1) {
    const targetDate = new Date(now)
    targetDate.setDate(now.getDate() + offset)
    const targetDay = targetDate.getDay()
    const currentMinutes = offset === 0 ? getMinutesOfDay(now) : -1

    const nextWindow = windows.find((item) => {
      if (!item.dayIndexes.includes(targetDay)) {
        return false
      }
      return offset > 0 || item.startMinutes > currentMinutes
    })

    if (nextWindow) {
      const openDate = new Date(targetDate)
      openDate.setHours(Math.floor(nextWindow.startMinutes / 60), nextWindow.startMinutes % 60, 0, 0)
      return formatDateTime(openDate)
    }
  }

  return '待同步'
}

const buildTradingStatus = () => {
  const now = new Date()
  const day = now.getDay()
  const currentMinutes = getMinutesOfDay(now)
  const activeWindow = cachedTradingWindows.find((item) => {
    return item.dayIndexes.includes(day)
      && currentMinutes >= item.startMinutes
      && currentMinutes < item.endMinutes
  })

  if (activeWindow) {
    return {
      isOpen: true,
      statusText: '开盘',
      currentSession: activeWindow.label,
      nextOpenTime: '当前时段交易中',
      disabledReason: '',
      syncMode: '已按上金所交易时段自动同步',
    }
  }

  return {
    isOpen: false,
    statusText: '休市',
    currentSession: '当前不在交易时段',
    nextOpenTime: getNextOpenTime(cachedTradingWindows, now),
    disabledReason: '当前为休市时段，暂不支持提交买卖订单',
    syncMode: '已按上金所交易时段自动同步',
  }
}

const normalizePeriods = (items) => {
  if (!Array.isArray(items)) {
    return cloneData(marketPeriodsFallback)
  }

  const normalized = items
    .filter((item) => EXPECTED_PERIOD_VALUES.includes(item?.value))
    .map((item) => {
      const fallback = marketPeriodsFallback.find((period) => period.value === item.value)
      return {
        label: fallback?.label || item.label,
        value: item.value,
        type: fallback?.type || item.type || 'candle',
      }
    })

  if (normalized.length !== EXPECTED_PERIOD_VALUES.length) {
    return cloneData(marketPeriodsFallback)
  }

  return EXPECTED_PERIOD_VALUES.map((value) => normalized.find((item) => item.value === value))
}

const bootstrapTradingWindows = async () => {
  if (hasBootstrappedTradingWindows) {
    return cachedTradingWindows
  }

  hasBootstrappedTradingWindows = true

  try {
    const response = await fetch(`${API_BASE}/api/market/periods`)
    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}
    const remoteWindows = Array.isArray(payload?.data)
      ? payload.data.filter((item) => Array.isArray(item.dayIndexes) && item.startMinutes != null && item.endMinutes != null)
      : []

    cachedTradingWindows = response.ok && remoteWindows.length ? remoteWindows : DEFAULT_TRADING_WINDOWS
  } catch (error) {
    cachedTradingWindows = DEFAULT_TRADING_WINDOWS
  }

  return cachedTradingWindows
}

const buildMergedMarketQuotes = (remoteQuotes = []) => {
  const remoteMap = new Map(Array.isArray(remoteQuotes) ? remoteQuotes.map((item) => [item.id, item]) : [])

  return INSTRUMENT_CATALOG.map((catalog) => {
    if (EXTERNAL_IDS.has(catalog.id) && remoteMap.has(catalog.id)) {
      return normalizeRemoteQuote(remoteMap.get(catalog.id), catalog)
    }
    return buildLocalQuote(catalog)
  })
}

export const MarketService = {
  async getPrices() {
    try {
      const response = await apiFetch('/api/market/prices')
      return {
        code: 200,
        data: buildMergedMarketQuotes(response?.data || []),
      }
    } catch (error) {
      const fallbackData = buildMergedMarketQuotes(cloneData(marketPricesFallback))
      return { code: 200, data: fallbackData }
    }
  },

  async getPeriods() {
    try {
      const payload = await apiFetch('/api/market/periods')
      return {
        ...payload,
        data: normalizePeriods(payload?.data),
      }
    } catch (error) {
      return { code: 200, data: cloneData(marketPeriodsFallback) }
    }
  },

  async getKLine(assetId, period) {
    try {
      return await apiFetch(`/api/market/kline?period=${period}&asset=${assetId}`)
    } catch (error) {
      return { code: 200, data: buildKLineFallback(assetId, period) }
    }
  },

  async getTradingStatus() {
    await bootstrapTradingWindows()
    return buildTradingStatus()
  }
}
