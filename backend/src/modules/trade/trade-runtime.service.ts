import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'

type TradingWindow = {
  label: string
  dayIndexes: number[]
  startMinutes: number
  endMinutes: number
}

type TradingRuntimeStatus = {
  source: string
  syncStatus: 'synced' | 'fallback'
  lastSyncedAt: string
  isOpen: boolean
  status: 'OPEN' | 'CLOSED' | 'PAUSED'
  currentSession: string
  currentWindow: string
  nextOpenAt: string
  paused: boolean
  isHoliday: boolean
}

const DEFAULT_WINDOWS: TradingWindow[] = [
  {
    label: '上午盘 09:00 - 11:30',
    dayIndexes: [1, 2, 3, 4, 5],
    startMinutes: 9 * 60,
    endMinutes: 11 * 60 + 30,
  },
  {
    label: '下午盘 13:30 - 15:30',
    dayIndexes: [1, 2, 3, 4, 5],
    startMinutes: 13 * 60 + 30,
    endMinutes: 15 * 60 + 30,
  },
  {
    label: '夜盘 20:00 - 23:59',
    dayIndexes: [1, 2, 3, 4, 5],
    startMinutes: 20 * 60,
    endMinutes: 24 * 60,
  },
  {
    label: '夜盘 00:00 - 02:30',
    dayIndexes: [2, 3, 4, 5, 6],
    startMinutes: 0,
    endMinutes: 2 * 60 + 30,
  },
]

@Injectable()
export class TradeRuntimeService {
  private readonly logger = new Logger(TradeRuntimeService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.syncTradingCalendar()
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncTradingCalendar() {
    const windows = await this.resolveTradingWindows()
    const status = await this.computeRuntimeStatus(windows)

    await Promise.all([
      this.upsertConfig('trade_sessions', windows as unknown as Prisma.InputJsonValue),
      this.upsertConfig('trade_runtime_status', status as unknown as Prisma.InputJsonValue),
    ])
  }

  async ensureTradingAllowed() {
    const status = await this.getRuntimeStatus()
    if (status.status === 'PAUSED') {
      throw new Error('TRADING_PAUSED')
    }
    if (!status.isOpen) {
      throw new Error('TRADING_CLOSED')
    }
  }

  async getRuntimeStatus(): Promise<TradingRuntimeStatus> {
    const config = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: 'trade_runtime_status',
      },
    })

    if (config) {
      const value = this.toRecord(config.configValue)
      if (typeof value.lastSyncedAt === 'string') {
        return {
          source: typeof value.source === 'string' ? value.source : 'system-config',
          syncStatus: value.syncStatus === 'fallback' ? 'fallback' : 'synced',
          lastSyncedAt: value.lastSyncedAt,
          isOpen: Boolean(value.isOpen),
          status: value.status === 'PAUSED' ? 'PAUSED' : value.status === 'OPEN' ? 'OPEN' : 'CLOSED',
          currentSession: typeof value.currentSession === 'string' ? value.currentSession : '交易时段同步中',
          currentWindow: typeof value.currentWindow === 'string' ? value.currentWindow : '交易时段同步中',
          nextOpenAt: typeof value.nextOpenAt === 'string' ? value.nextOpenAt : '--',
          paused: Boolean(value.paused),
          isHoliday: Boolean(value.isHoliday),
        }
      }
    }

    const windows = await this.resolveTradingWindows()
    return this.computeRuntimeStatus(windows)
  }

  async getTradingWindows() {
    const windows = await this.resolveTradingWindows()
    return windows.map((item) => ({
      ...item,
      session: this.formatWindow(item),
      status: '生效中',
    }))
  }

  private async resolveTradingWindows() {
    const config = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: 'trade_sessions',
      },
    })

    if (config) {
      const value = Array.isArray(config.configValue)
        ? config.configValue
        : Array.isArray(this.toRecord(config.configValue).windows)
          ? (this.toRecord(config.configValue).windows as unknown[])
          : []

      const parsed = value
        .map((item) => this.toRecord(item))
        .filter(
          (item) =>
            typeof item.label === 'string' &&
            Array.isArray(item.dayIndexes) &&
            typeof item.startMinutes === 'number' &&
            typeof item.endMinutes === 'number',
        )
        .map((item) => ({
          label: item.label as string,
          dayIndexes: item.dayIndexes as number[],
          startMinutes: item.startMinutes as number,
          endMinutes: item.endMinutes as number,
        }))

      if (parsed.length) {
        return parsed
      }
    }

    return DEFAULT_WINDOWS
  }

  private async computeRuntimeStatus(windows: TradingWindow[]): Promise<TradingRuntimeStatus> {
    const now = new Date()
    const tradeState = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: 'trade_manual_control',
      },
    })
    const overrides = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: 'trade_holiday_overrides',
      },
    })

    const manual = this.toRecord(tradeState?.configValue)
    const paused = manual.paused === true
    const holidayDates = Array.isArray(overrides?.configValue)
      ? (overrides?.configValue as unknown[])
      : Array.isArray(this.toRecord(overrides?.configValue).dates)
        ? (this.toRecord(overrides?.configValue).dates as unknown[])
        : []
    const currentDateKey = this.toDateKey(now)
    const isHoliday = holidayDates.some((item) => item === currentDateKey)

    const activeWindow = isHoliday ? null : this.findActiveWindow(windows, now)
    const nextOpenAt = isHoliday ? this.findNextOpenTime(windows, now, holidayDates) : this.findNextOpenTime(windows, now, holidayDates)

    return {
      source: this.configService.get<string>('SGE_CALENDAR_API_URL') ? 'sge-calendar+fallback' : 'local-trading-calendar',
      syncStatus: this.configService.get<string>('SGE_CALENDAR_API_URL') ? 'fallback' : 'synced',
      lastSyncedAt: now.toISOString(),
      isOpen: !paused && !isHoliday && Boolean(activeWindow),
      status: paused ? 'PAUSED' : !isHoliday && activeWindow ? 'OPEN' : 'CLOSED',
      currentSession: activeWindow ? activeWindow.label : isHoliday ? '节假日休市' : '当前不在交易时段',
      currentWindow: activeWindow ? this.formatWindow(activeWindow) : '暂无可交易窗口',
      nextOpenAt,
      paused,
      isHoliday,
    }
  }

  private findActiveWindow(windows: TradingWindow[], now: Date) {
    const day = now.getDay()
    const minutes = now.getHours() * 60 + now.getMinutes()
    return windows.find((item) => item.dayIndexes.includes(day) && minutes >= item.startMinutes && minutes < item.endMinutes)
  }

  private findNextOpenTime(windows: TradingWindow[], now: Date, holidays: unknown[]) {
    for (let offset = 0; offset < 8; offset += 1) {
      const targetDate = new Date(now)
      targetDate.setDate(now.getDate() + offset)
      const dateKey = this.toDateKey(targetDate)
      if (holidays.some((item) => item === dateKey)) {
        continue
      }

      const targetDay = targetDate.getDay()
      const currentMinutes = offset === 0 ? now.getHours() * 60 + now.getMinutes() : -1
      const nextWindow = windows.find((item) => {
        if (!item.dayIndexes.includes(targetDay)) {
          return false
        }
        return offset > 0 || item.startMinutes > currentMinutes
      })

      if (nextWindow) {
        const openAt = new Date(targetDate)
        openAt.setHours(Math.floor(nextWindow.startMinutes / 60), nextWindow.startMinutes % 60, 0, 0)
        return openAt.toISOString()
      }
    }

    return '--'
  }

  private formatWindow(window: TradingWindow) {
    const pad = (value: number) => String(value).padStart(2, '0')
    const startHour = Math.floor(window.startMinutes / 60)
    const startMinute = window.startMinutes % 60
    const endHour = Math.floor(window.endMinutes / 60) % 24
    const endMinute = window.endMinutes % 60
    return `${pad(startHour)}:${pad(startMinute)} - ${pad(endHour)}:${pad(endMinute)}`
  }

  private async upsertConfig(configKey: string, configValue: Prisma.InputJsonValue) {
    await this.prisma.systemConfig.upsert({
      where: { configKey },
      create: { configKey, configValue },
      update: { configValue },
    })
  }

  private toRecord(value: unknown) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    return {}
  }

  private toDateKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
  }
}
