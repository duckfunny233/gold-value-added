import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { TradeRuntimeService } from '../trade/trade-runtime.service'

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name)
  private memoryCache:
    | {
        price: number
        source: string
        timestamp: string
        status: 'live' | 'degraded'
      }
    | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly tradeRuntimeService: TradeRuntimeService,
  ) {}

  async getTicker() {
    const now = new Date()
    const providerQuote = await this.fetchProviderQuote()
    if (providerQuote) {
      this.memoryCache = providerQuote
      await this.upsertConfig(
        'market_quote_au9999',
        {
          ...providerQuote,
          refreshSeconds: 4,
        } as unknown as Prisma.InputJsonValue,
      )
      return {
        assetCode: 'AU9999',
        price: providerQuote.price,
        change: '-',
        precision: 0.01,
        refreshSeconds: 4,
        timestamp: providerQuote.timestamp,
        source: providerQuote.source,
        status: providerQuote.status,
      }
    }

    const config = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: 'market_quote_au9999',
      },
    })
    const cached = this.toRecord(config?.configValue)
    if (typeof cached.price === 'number') {
      return {
        assetCode: 'AU9999',
        price: this.toPrice(cached.price),
        change: '-',
        precision: 0.01,
        refreshSeconds: 4,
        timestamp: typeof cached.timestamp === 'string' ? cached.timestamp : now.toISOString(),
        source: typeof cached.source === 'string' ? cached.source : 'system-config-cache',
        status: 'degraded',
      }
    }

    const latestTrade = await this.prisma.tradeMatch.findFirst({
      orderBy: {
        matchedAt: 'desc',
      },
    })
    const fallbackPrice = latestTrade ? this.toPrice(Number(latestTrade.matchedPrice)) : 568.32
    return {
      assetCode: 'AU9999',
      price: fallbackPrice,
      change: '-',
      precision: 0.01,
      refreshSeconds: 4,
      timestamp: now.toISOString(),
      source: latestTrade ? 'trade-match-fallback' : 'local-default',
      status: 'degraded',
    }
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

  private async fetchProviderQuote() {
    const url = this.configService.get<string>('MARKET_TICKER_URL')
    if (!url) {
      return null
    }

    try {
      const response = await fetch(url, {
        headers: this.configService.get<string>('MARKET_TICKER_API_KEY')
          ? {
              Authorization: `Bearer ${this.configService.get<string>('MARKET_TICKER_API_KEY')}`,
            }
          : undefined,
      })

      if (!response.ok) {
        throw new Error(`http_${response.status}`)
      }

      const payload = (await response.json()) as Record<string, unknown>
      const rawPrice = payload.price ?? payload.lastPrice ?? payload.last ?? payload.data
      const parsedPrice =
        typeof rawPrice === 'number'
          ? rawPrice
          : typeof rawPrice === 'string'
            ? Number(rawPrice)
            : typeof rawPrice === 'object' && rawPrice && 'price' in rawPrice
              ? Number((rawPrice as Record<string, unknown>).price)
              : NaN

      if (!Number.isFinite(parsedPrice)) {
        throw new Error('invalid_price_payload')
      }

      return {
        price: this.toPrice(parsedPrice),
        source: 'market-provider',
        timestamp: new Date().toISOString(),
        status: 'live' as const,
      }
    } catch (error) {
      this.logger.error(
        `[MARKET_TICKER_FAILED] AU9999 行情拉取失败: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }

  private async upsertConfig(configKey: string, configValue: Prisma.InputJsonValue) {
    await this.prisma.systemConfig.upsert({
      where: { configKey },
      create: { configKey, configValue },
      update: { configValue },
    })
  }

  private toPrice(value: number) {
    return Number(value.toFixed(2))
  }

  private toRecord(value: unknown) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    return {}
  }
}
