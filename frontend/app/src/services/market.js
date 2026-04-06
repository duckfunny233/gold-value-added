import { apiFetch } from '../utils/request'

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

let cachedTradingWindows = DEFAULT_TRADING_WINDOWS
let hasBootstrappedTradingWindows = false

const pad = (value) => String(value).padStart(2, '0')

const formatDateTime = (date) => {
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  return `${month}-${day} ${hour}:${minute}`
}

const getMinutesOfDay = (date) => date.getHours() * 60 + date.getMinutes()

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

const bootstrapTradingWindows = async () => {
  if (hasBootstrappedTradingWindows) {
    return cachedTradingWindows
  }

  hasBootstrappedTradingWindows = true

  try {
    const response = await apiFetch('/api/market/periods')
    const remoteWindows = Array.isArray(response?.data)
      ? response.data.filter((item) => Array.isArray(item.dayIndexes) && item.startMinutes != null && item.endMinutes != null)
      : []

    cachedTradingWindows = remoteWindows.length ? remoteWindows : DEFAULT_TRADING_WINDOWS
  } catch (error) {
    cachedTradingWindows = DEFAULT_TRADING_WINDOWS
  }

  return cachedTradingWindows
}

export const MarketService = {
  getPrices() {
    return apiFetch('/api/market/prices')
  },

  getPeriods() {
    return apiFetch('/api/market/periods')
  },

  getKLine(assetId, period) {
    return apiFetch(`/api/market/kline?period=${period}&asset=${assetId}`)
  },

  async getTradingStatus() {
    await bootstrapTradingWindows()
    return buildTradingStatus()
  }
}
