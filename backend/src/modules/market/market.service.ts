import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { TradeSide, TradeStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { TradeRuntimeService } from '../trade/trade-runtime.service'

const OUNCE_TO_GRAM = 31.1035
const CHART_PERIODS = ['1m', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const
const ORDER_BOOK_DEPTH = 5
const MS_IN_MINUTE = 60 * 1000

type ChartPeriod = (typeof CHART_PERIODS)[number]
type MarketAssetConfig = {
  symbol: string
  name: string
  basePrice: number
  decimals: number
  url?: string
}
type MarketAssetCode = keyof typeof MARKET_PRICE_CONFIG
type CandleRow = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}
type TradeTick = {
  timestamp: number
  price: number
  volume: number
}
type MarketPeriodOption = {
  label: string
  value: ChartPeriod
  type: 'area' | 'candle'
}

const MARKET_PRICE_CONFIG: Record<string, MarketAssetConfig> = {
  AU9999: {
    symbol: 'XAU',
    name: '现货黄金',
    basePrice: 1046.2,
    decimals: 2,
    url: 'https://api.gold-api.com/price/XAU/CNY',
  },
  AUTD: {
    symbol: 'AUTD',
    name: '黄金延期',
    basePrice: 1048.5,
    decimals: 2,
  },
  AG9999: {
    symbol: 'XAG',
    name: '现货白银',
    basePrice: 16.65,
    decimals: 2,
    url: 'https://api.gold-api.com/price/XAG/CNY',
  },
  AGTD: {
    symbol: 'AGTD',
    name: '白银延期',
    basePrice: 18.83,
    decimals: 2,
  },
  LME_CU: {
    symbol: 'LME_CU',
    name: '伦敦铜',
    basePrice: 0.086,
    decimals: 4,
  },
  LME_AL: {
    symbol: 'LME_AL',
    name: '伦敦铝',
    basePrice: 0.0238,
    decimals: 4,
  },
  SH_CU: {
    symbol: 'SH_CU',
    name: '上海铜',
    basePrice: 0.0978,
    decimals: 4,
  },
  SH_AL: {
    symbol: 'SH_AL',
    name: '上海铝',
    basePrice: 0.0195,
    decimals: 4,
  },
  SH_ZN: {
    symbol: 'SH_ZN',
    name: '上海锌',
    basePrice: 0.021,
    decimals: 4,
  },
  SH_NI: {
    symbol: 'SH_NI',
    name: '上海镍',
    basePrice: 0.135,
    decimals: 4,
  },
  SH_RB: {
    symbol: 'SH_RB',
    name: '螺纹钢',
    basePrice: 0.003093,
    decimals: 6,
  },
  SH_J: {
    symbol: 'SH_J',
    name: '焦炭',
    basePrice: 0.0022,
    decimals: 6,
  },
  OIL: {
    symbol: 'OIL',
    name: '美原油',
    basePrice: 62.3,
    decimals: 2,
  },
  BRENT: {
    symbol: 'BRENT',
    name: '布伦特原油',
    basePrice: 66.8,
    decimals: 2,
  },
  NG: {
    symbol: 'NG',
    name: '天然气',
    basePrice: 2.85,
    decimals: 2,
  },
  USD_CNY: {
    symbol: 'USD_CNY',
    name: '美元兑人民币',
    basePrice: 6.8305,
    decimals: 4,
  },
  EUR_USD: {
    symbol: 'EUR_USD',
    name: '欧元兑美元',
    basePrice: 1.1725,
    decimals: 4,
  },
  GBP_USD: {
    symbol: 'GBP_USD',
    name: '英镑兑美元',
    basePrice: 1.3463,
    decimals: 4,
  },
  USD_JPY: {
    symbol: 'USD_JPY',
    name: '美元兑日元',
    basePrice: 148.2,
    decimals: 2,
  },
  USDX: {
    symbol: 'USDX',
    name: '美元指数',
    basePrice: 98.645,
    decimals: 3,
  },
  SSE: {
    symbol: 'SSE',
    name: '上证指数',
    basePrice: 3986.22,
    decimals: 2,
  },
  SZSE: {
    symbol: 'SZSE',
    name: '深证成指',
    basePrice: 14309.47,
    decimals: 2,
  },
  CYB: {
    symbol: 'CYB',
    name: '创业板指',
    basePrice: 3448.79,
    decimals: 2,
  },
  NASDAQ: {
    symbol: 'NASDAQ',
    name: '纳斯达克',
    basePrice: 19645.77,
    decimals: 2,
  },
  DJI: {
    symbol: 'DJI',
    name: '道琼斯',
    basePrice: 39800,
    decimals: 2,
  },
  SPX: {
    symbol: 'SPX',
    name: '标普500',
    basePrice: 5280,
    decimals: 2,
  },
} as const

const PERIOD_LOOKBACK: Record<ChartPeriod, number> = {
  '1m': 120,
  hourly: 72,
  daily: 60,
  weekly: 52,
  monthly: 36,
  quarterly: 20,
  yearly: 10,
}
const MARKET_PERIOD_OPTIONS: MarketPeriodOption[] = [
  { label: 'market.timeShare', value: '1m', type: 'area' },
  { label: 'market.hourlyK', value: 'hourly', type: 'candle' },
  { label: 'market.dailyK', value: 'daily', type: 'candle' },
  { label: 'market.weeklyK', value: 'weekly', type: 'candle' },
  { label: 'market.monthlyK', value: 'monthly', type: 'candle' },
  { label: 'market.quarterlyK', value: 'quarterly', type: 'candle' },
  { label: 'market.yearlyK', value: 'yearly', type: 'candle' },
]

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name)
  private readonly latestPrices = new Map<string, number>()

  constructor(
    private readonly tradeRuntimeService: TradeRuntimeService,
    private readonly prisma: PrismaService,
  ) {}

  async getTicker(assetCode: MarketAssetCode = 'AU9999') {
    return this.fetchMetalQuote(assetCode)
  }

  async getPrices() {
    const assets = Object.keys(MARKET_PRICE_CONFIG) as MarketAssetCode[]
    const quotes = await Promise.all(
      assets.map(async (assetCode) => {
        const config = MARKET_PRICE_CONFIG[assetCode]
        if (config.url) {
          try {
            return await this.fetchMetalQuote(assetCode)
          } catch (error) {
            this.logger.warn(
              `[MARKET_FALLBACK] ${assetCode} 使用本地兜底行情: ${this.toErrorMessage(error)}`,
            )
          }
        }
        return this.buildLocalQuote(assetCode)
      }),
    )

    return quotes
  }

  async getTradingPeriods() {
    return MARKET_PERIOD_OPTIONS
  }

  async getKLine(assetCode = 'AU9999', period = '1m') {
    const resolvedPeriod = this.normalizePeriod(period)
    const resolvedAssetCode = this.normalizeAssetCode(assetCode)
    const bucketCount = PERIOD_LOOKBACK[resolvedPeriod]
    const now = new Date()
    const bucketStarts = this.buildBucketStarts(resolvedPeriod, bucketCount, now)
    const anchorPrice = await this.resolveAnchorPrice(resolvedAssetCode)
    const tradeTicks = await this.loadTradeTicks(resolvedAssetCode, bucketStarts[0], now)

    const rows =
      tradeTicks.length === 0
        ? this.buildSyntheticCandles(
            resolvedAssetCode,
            resolvedPeriod,
            bucketStarts,
            anchorPrice,
          )
        : this.aggregateCandles(
            resolvedAssetCode,
            resolvedPeriod,
            bucketStarts,
            tradeTicks,
            anchorPrice,
          )

    return rows.map((item) => ({
      ...item,
      // 兼容文档字段，前端图表仍使用 timestamp
      time: item.timestamp,
    }))
  }

  async getOrderBook(assetCode = 'AU9999') {
    const resolvedAssetCode = this.normalizeAssetCode(assetCode)
    const orders = await this.prisma.tradeOrder.findMany({
      where: {
        assetCode: resolvedAssetCode,
        status: {
          in: [TradeStatus.OPEN, TradeStatus.PARTIALLY_FILLED],
        },
      },
      select: {
        side: true,
        price: true,
        quantityGrams: true,
        filledGrams: true,
      },
      orderBy: [{ submittedAt: 'asc' }],
      take: 2000,
    })

    if (!orders.length) {
      const anchorPrice = await this.resolveOrderBookAnchorPrice(resolvedAssetCode)
      return this.buildSyntheticOrderBook(anchorPrice)
    }

    const buy = this.buildOrderBookLevels(orders, TradeSide.BUY)
    const sell = this.buildOrderBookLevels(orders, TradeSide.SELL)

    return {
      asset: resolvedAssetCode,
      buy,
      sell,
      updatedAt: this.formatOrderBookUpdatedAt(new Date()),
    }
  }

  private async fetchMetalQuote(assetCode: MarketAssetCode) {
    const config = MARKET_PRICE_CONFIG[assetCode]
    if (!config.url) {
      throw new BadRequestException(`[MARKET_TICKER_FAILED] ${assetCode} 未配置外部行情地址`)
    }

    const response = await fetch(config.url)

    if (!response.ok) {
      const message = `[MARKET_TICKER_FAILED] ${assetCode} 行情拉取失败: http_${response.status}`
      this.logger.error(message)
      throw new Error(message)
    }

    const payload = (await response.json()) as Record<string, unknown>
    const ouncePrice = Number(payload.price)

    if (!Number.isFinite(ouncePrice)) {
      const message = `[MARKET_TICKER_FAILED] ${assetCode} 行情拉取失败: invalid_price_payload`
      this.logger.error(message)
      throw new Error(message)
    }

    const pricePerGram = this.toPrice(ouncePrice / OUNCE_TO_GRAM, config.decimals)
    const previousPrice = this.latestPrices.get(assetCode) ?? pricePerGram
    const percentChange = previousPrice === 0 ? 0 : ((pricePerGram - previousPrice) / previousPrice) * 100

    this.latestPrices.set(assetCode, pricePerGram)

    return {
      id: assetCode,
      assetCode,
      symbol: config.symbol,
      name: config.name,
      currency: typeof payload.currency === 'string' ? payload.currency : 'CNY',
      currencySymbol: typeof payload.currencySymbol === 'string' ? payload.currencySymbol : '¥',
      price: pricePerGram,
      change: `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`,
      up: percentChange >= 0,
      precision: 0.01,
      refreshSeconds: 4,
      timestamp: typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString(),
      updatedAtReadable:
        typeof payload.updatedAtReadable === 'string' ? payload.updatedAtReadable : 'just now',
      source: 'gold-api.com',
      status: 'live' as const,
    }
  }

  private normalizePeriod(period?: string): ChartPeriod {
    if (!period || CHART_PERIODS.includes(period as ChartPeriod)) {
      return (period as ChartPeriod) || '1m'
    }

    throw new BadRequestException(`不支持的 K 线周期: ${period}`)
  }

  private normalizeAssetCode(assetCode?: string) {
    const resolved = (assetCode || 'AU9999').trim().toUpperCase()
    if (resolved in MARKET_PRICE_CONFIG) {
      return resolved as MarketAssetCode
    }

    throw new BadRequestException(`不支持的行情标的: ${assetCode}`)
  }

  private async resolveAnchorPrice(assetCode: MarketAssetCode) {
    const latestMatch = await this.prisma.tradeMatch.findFirst({
      where: {
        OR: [{ buyOrder: { assetCode } }, { sellOrder: { assetCode } }],
      },
      orderBy: {
        matchedAt: 'desc',
      },
      select: {
        matchedPrice: true,
      },
    })

    if (latestMatch) {
      return this.toPrice(Number(latestMatch.matchedPrice), MARKET_PRICE_CONFIG[assetCode].decimals)
    }

    if (assetCode === 'AU9999' || assetCode === 'AG9999') {
      const quote = await this.fetchMetalQuote(assetCode)
      return quote.price
    }

    return MARKET_PRICE_CONFIG[assetCode].basePrice
  }

  private async loadTradeTicks(assetCode: MarketAssetCode, startAt: Date, endAt: Date): Promise<TradeTick[]> {
    const matches = await this.prisma.tradeMatch.findMany({
      where: {
        matchedAt: {
          gte: startAt,
          lte: endAt,
        },
        OR: [{ buyOrder: { assetCode } }, { sellOrder: { assetCode } }],
      },
      orderBy: {
        matchedAt: 'asc',
      },
      select: {
        matchedAt: true,
        matchedPrice: true,
        matchedGrams: true,
      },
    })

    return matches.map((item) => ({
      timestamp: item.matchedAt.getTime(),
      price: Number(item.matchedPrice),
      volume: Number(item.matchedGrams),
    }))
  }

  private aggregateCandles(
    assetCode: MarketAssetCode,
    period: ChartPeriod,
    bucketStarts: Date[],
    ticks: TradeTick[],
    anchorPrice: number,
  ) {
    const pricePrecision = MARKET_PRICE_CONFIG[assetCode].decimals
    const bucketMap = new Map<number, TradeTick[]>()

    for (const tick of ticks) {
      const bucketTimestamp = this.getBucketStart(new Date(tick.timestamp), period).getTime()
      const bucketTicks = bucketMap.get(bucketTimestamp) || []
      bucketTicks.push(tick)
      bucketMap.set(bucketTimestamp, bucketTicks)
    }

    let previousClose = anchorPrice

    return bucketStarts.map((bucketStart) => {
      const rows = bucketMap.get(bucketStart.getTime()) || []
      if (rows.length === 0) {
        return this.createFlatCandle(bucketStart, previousClose, pricePrecision)
      }

      const open = rows[0].price
      const close = rows[rows.length - 1].price
      const high = Math.max(...rows.map((item) => item.price))
      const low = Math.min(...rows.map((item) => item.price))
      const volume = rows.reduce((sum, item) => sum + item.volume, 0)

      previousClose = close

      return {
        timestamp: bucketStart.getTime(),
        open: this.toPrice(open, pricePrecision),
        high: this.toPrice(high, pricePrecision),
        low: this.toPrice(low, pricePrecision),
        close: this.toPrice(close, pricePrecision),
        volume: this.toPrice(volume, 4),
      }
    })
  }

  private buildSyntheticCandles(
    assetCode: MarketAssetCode,
    period: ChartPeriod,
    bucketStarts: Date[],
    anchorPrice: number,
  ) {
    const pricePrecision = MARKET_PRICE_CONFIG[assetCode].decimals
    const assetSeed = Array.from(assetCode).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    let previousClose = anchorPrice

    return bucketStarts.map((bucketStart, index) => {
      const wave = Math.sin((assetSeed + index) / 3.2) * 0.006
      const bias = Math.cos((assetSeed + index) / 5.1) * 0.003
      const drift = (index - bucketStarts.length / 2) / bucketStarts.length / 25
      const open = previousClose
      const close = anchorPrice * (1 + wave + bias + drift)
      const high = Math.max(open, close) * 1.0022
      const low = Math.min(open, close) * 0.9978
      const volume = Math.max(0, Math.round((assetSeed + index * 37 + period.length * 11) % 900) + 100)

      previousClose = close

      return {
        timestamp: bucketStart.getTime(),
        open: this.toPrice(open, pricePrecision),
        high: this.toPrice(high, pricePrecision),
        low: this.toPrice(low, pricePrecision),
        close: this.toPrice(close, pricePrecision),
        volume,
      }
    })
  }

  private createFlatCandle(bucketStart: Date, price: number, precision: number): CandleRow {
    const resolvedPrice = this.toPrice(price, precision)
    return {
      timestamp: bucketStart.getTime(),
      open: resolvedPrice,
      high: resolvedPrice,
      low: resolvedPrice,
      close: resolvedPrice,
      volume: 0,
    }
  }

  private buildBucketStarts(period: ChartPeriod, bucketCount: number, now: Date) {
    const lastBucketStart = this.getBucketStart(now, period)
    const bucketStarts: Date[] = []

    for (let index = bucketCount - 1; index >= 0; index -= 1) {
      bucketStarts.push(this.shiftBucket(lastBucketStart, period, -index))
    }

    return bucketStarts
  }

  private getBucketStart(date: Date, period: ChartPeriod) {
    const bucketStart = new Date(date)

    if (period === '1m') {
      bucketStart.setSeconds(0, 0)
      return bucketStart
    }

    if (period === 'hourly') {
      bucketStart.setMinutes(0, 0, 0)
      return bucketStart
    }

    bucketStart.setHours(0, 0, 0, 0)

    if (period === 'daily') {
      return bucketStart
    }

    if (period === 'weekly') {
      const weekDay = bucketStart.getDay()
      const diff = weekDay === 0 ? -6 : 1 - weekDay
      bucketStart.setDate(bucketStart.getDate() + diff)
      return bucketStart
    }

    if (period === 'monthly') {
      bucketStart.setDate(1)
      return bucketStart
    }

    if (period === 'quarterly') {
      bucketStart.setDate(1)
      bucketStart.setMonth(Math.floor(bucketStart.getMonth() / 3) * 3)
      return bucketStart
    }

    bucketStart.setDate(1)
    bucketStart.setMonth(0)
    return bucketStart
  }

  private shiftBucket(date: Date, period: ChartPeriod, steps: number) {
    const shifted = new Date(date)

    if (period === '1m') {
      shifted.setTime(shifted.getTime() + steps * MS_IN_MINUTE)
      return shifted
    }

    if (period === 'hourly') {
      shifted.setTime(shifted.getTime() + steps * 60 * MS_IN_MINUTE)
      return shifted
    }

    if (period === 'daily') {
      shifted.setDate(shifted.getDate() + steps)
      return shifted
    }

    if (period === 'weekly') {
      shifted.setDate(shifted.getDate() + steps * 7)
      return shifted
    }

    if (period === 'monthly') {
      shifted.setMonth(shifted.getMonth() + steps)
      return shifted
    }

    if (period === 'quarterly') {
      shifted.setMonth(shifted.getMonth() + steps * 3)
      return shifted
    }

    shifted.setFullYear(shifted.getFullYear() + steps)
    return shifted
  }

  private toPrice(value: number, decimals = 2) {
    return Number(value.toFixed(decimals))
  }

  private toErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message
    }
    return 'unknown_error'
  }

  private buildLocalQuote(assetCode: MarketAssetCode) {
    const config = MARKET_PRICE_CONFIG[assetCode]
    const previousPrice = this.latestPrices.get(assetCode) ?? config.basePrice
    const randomDrift = (Math.random() - 0.5) * config.basePrice * 0.003
    const nextPrice = Math.max(config.basePrice * 0.35, previousPrice + randomDrift)
    const normalizedPrice = this.toPrice(nextPrice, config.decimals)
    const percentChange =
      previousPrice === 0 ? 0 : ((normalizedPrice - previousPrice) / previousPrice) * 100

    this.latestPrices.set(assetCode, normalizedPrice)

    return {
      id: assetCode,
      assetCode,
      symbol: config.symbol,
      name: config.name,
      currency: 'CNY',
      currencySymbol: '¥',
      price: normalizedPrice,
      change: `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`,
      up: percentChange >= 0,
      precision: 0.01,
      refreshSeconds: 4,
      timestamp: new Date().toISOString(),
      updatedAtReadable: 'just now',
      source: 'local-fallback',
      status: 'degraded' as const,
    }
  }

  private buildOrderBookLevels(
    orders: Array<{
      side: TradeSide
      price: unknown
      quantityGrams: unknown
      filledGrams: unknown
    }>,
    side: TradeSide,
  ) {
    const levelMap = new Map<number, number>()

    for (const item of orders) {
      if (item.side !== side) {
        continue
      }
      const price = Number(item.price)
      const quantity = Number(item.quantityGrams)
      const filled = Number(item.filledGrams)
      const remaining = quantity - filled
      if (!Number.isFinite(price) || !Number.isFinite(remaining) || remaining <= 0) {
        continue
      }
      levelMap.set(price, (levelMap.get(price) || 0) + remaining)
    }

    const levels = Array.from(levelMap.entries())
      .map(([price, quantity]) => ({
        price: this.toPrice(price, 2),
        quantity: Number(quantity.toFixed(4)),
      }))
      .sort((left, right) => {
        return side === TradeSide.BUY
          ? right.price - left.price
          : left.price - right.price
      })
      .slice(0, ORDER_BOOK_DEPTH)

    if (side === TradeSide.SELL) {
      return levels
        .slice()
        .reverse()
        .map((item, index) => ({
          level: levels.length - index,
          price: item.price.toFixed(2),
          quantity: Number(item.quantity.toFixed(4)),
        }))
    }

    return levels.map((item, index) => ({
      level: index + 1,
      price: item.price.toFixed(2),
      quantity: Number(item.quantity.toFixed(4)),
    }))
  }

  private async resolveOrderBookAnchorPrice(assetCode: MarketAssetCode) {
    const latestMatch = await this.prisma.tradeMatch.findFirst({
      where: {
        OR: [{ buyOrder: { assetCode } }, { sellOrder: { assetCode } }],
      },
      orderBy: {
        matchedAt: 'desc',
      },
      select: {
        matchedPrice: true,
      },
    })
    if (latestMatch) {
      return Number(latestMatch.matchedPrice)
    }
    return this.latestPrices.get(assetCode) || MARKET_PRICE_CONFIG[assetCode].basePrice
  }

  private buildSyntheticOrderBook(anchorPrice: number) {
    const sell = Array.from({ length: ORDER_BOOK_DEPTH }, (_, index) => {
      const level = ORDER_BOOK_DEPTH - index
      const spread = level * 0.02
      return {
        level,
        price: this.toPrice(anchorPrice + spread, 2).toFixed(2),
        quantity: Number((12 + level * 3).toFixed(4)),
      }
    })

    const buy = Array.from({ length: ORDER_BOOK_DEPTH }, (_, index) => {
      const level = index + 1
      const spread = level * 0.02
      return {
        level,
        price: this.toPrice(anchorPrice - spread, 2).toFixed(2),
        quantity: Number((10 + level * 4).toFixed(4)),
      }
    })

    return {
      buy,
      sell,
      updatedAt: this.formatOrderBookUpdatedAt(new Date()),
    }
  }

  private formatOrderBookUpdatedAt(date: Date) {
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return `${hour}:${minute}:${second}`
  }
}
