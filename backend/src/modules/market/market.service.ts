import { Injectable, Logger } from '@nestjs/common'
import { TradeRuntimeService } from '../trade/trade-runtime.service'

const OUNCE_TO_GRAM = 31.1035

const METAL_CONFIG = {
  AU9999: {
    symbol: 'XAU',
    name: '现货黄金',
    url: 'https://api.gold-api.com/price/XAU/CNY',
  },
  AG9999: {
    symbol: 'XAG',
    name: '现货白银',
    url: 'https://api.gold-api.com/price/XAG/CNY',
  },
} as const

type MarketAssetCode = keyof typeof METAL_CONFIG

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name)
  private readonly latestPrices = new Map<MarketAssetCode, number>()

  constructor(private readonly tradeRuntimeService: TradeRuntimeService) {}

  async getTicker(assetCode: MarketAssetCode = 'AU9999') {
    return this.fetchMetalQuote(assetCode)
  }

  async getPrices() {
    return Promise.all([this.fetchMetalQuote('AU9999'), this.fetchMetalQuote('AG9999')])
  }

  async getTradingPeriods() {
    const windows = await this.tradeRuntimeService.getTradingWindows()
    return windows.map((item) => ({
      label: item.label,
      dayIndexes: item.dayIndexes,
      startMinutes: item.startMinutes,
      endMinutes: item.endMinutes,
      session: item.session,
      status: item.status,
    }))
  }

  private async fetchMetalQuote(assetCode: MarketAssetCode) {
    const config = METAL_CONFIG[assetCode]
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

    const pricePerGram = this.toPrice(ouncePrice / OUNCE_TO_GRAM)
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

  private toPrice(value: number) {
    return Number(value.toFixed(2))
  }
}
