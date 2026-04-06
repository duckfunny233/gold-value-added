import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { createHash } from 'crypto'
import { NEWS_CACHE_TTL_MS, NEWS_ERROR_CODES } from './dashboard.constants'
import { NoticeFeedResult, UnifiedNotice } from './dashboard.types'
import { Prisma } from '@prisma/client'
import { formatDateTime, pickFirstString, trimText } from './dashboard.utils'
import { PrismaService } from '../../prisma/prisma.service'

type RemoteNotice = {
  notice: UnifiedNotice
  rawPayload: Record<string, unknown>
}

@Injectable()
export class NewsFeedService implements OnModuleInit {
  private readonly logger = new Logger(NewsFeedService.name)
  private disabledLogged = false

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.refreshCache('startup')
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async refreshCacheBySchedule() {
    await this.refreshCache('schedule')
  }

  async getFeed(): Promise<NoticeFeedResult> {
    const url = this.getNewsApiUrl()

    if (url) {
      try {
        return await this.fetchAndPersistRemote(url)
      } catch (error) {
        return this.handleFetchFailure(error, 'request')
      }
    }

    this.logDisabled()
    return this.readDatabaseCache()
  }

  private async fetchAndPersistRemote(url: string): Promise<NoticeFeedResult> {
    const notices = await this.fetchRemoteNotices(url)
    await this.saveDatabaseCache(notices, url)

    return {
      notices: notices.map((item) => ({ ...item.notice })),
      meta: {
        source: 'remote',
        cachedAt: formatDateTime(new Date()),
      },
    }
  }

  private async refreshCache(reason: 'startup' | 'schedule') {
    const url = this.getNewsApiUrl()
    if (!url) {
      this.logDisabled()
      return
    }

    try {
      const notices = await this.fetchRemoteNotices(url)
      await this.saveDatabaseCache(notices, url)
      this.logger.log(`新闻缓存刷新成功 (${reason})，共 ${notices.length} 条`)
    } catch (error) {
      await this.handleFetchFailure(error, reason)
    }
  }

  private getNewsApiUrl() {
    return this.configService.get<string>('NEWS_API_URL')?.trim() || ''
  }

  private buildHeaders() {
    const apiKey = this.configService.get<string>('NEWS_API_KEY')?.trim()
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
      headers['X-API-Key'] = apiKey
    }

    return headers
  }

  private async fetchRemoteNotices(url: string) {
    const response = await fetch(url, {
      headers: this.buildHeaders(),
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : JSON.parse(await response.text())

    const items = this.extractItems(payload)
    const notices = items
      .map((item, index) => this.normalizeRemoteNotice(item, index))
      .filter((item): item is RemoteNotice => Boolean(item))
      .slice(0, 10)

    if (!notices.length) {
      throw new Error(NEWS_ERROR_CODES.EMPTY_RESPONSE)
    }

    return notices
  }

  private extractItems(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload
    }

    if (!payload || typeof payload !== 'object') {
      return []
    }

    const record = payload as Record<string, unknown>
    for (const key of ['data', 'items', 'articles', 'news', 'list', 'records', 'result']) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value
      }

      const nested = this.extractItems(value)
      if (nested.length) {
        return nested
      }
    }

    return []
  }

  private normalizeRemoteNotice(item: unknown, index: number): RemoteNotice | null {
    if (!item || typeof item !== 'object') {
      return null
    }

    const record = item as Record<string, unknown>
    const title = pickFirstString(record.title, record.headline, record.name, record.subject)
    if (!title) {
      return null
    }

    const content = trimText(
      pickFirstString(record.summary, record.description, record.content, record.text, record.body),
      180,
    )
    const publishedAt = this.parseDate(
      record.publishedAt,
      record.publishAt,
      record.pubDate,
      record.date,
      record.time,
      record.createdAt,
    )
    const linkUrl = pickFirstString(record.url, record.link, record.href)
    const imageUrl = pickFirstString(record.image, record.imageUrl, record.thumbnail, record.cover)
    const publishedAtIso = publishedAt ? publishedAt.toISOString() : null

    return {
      notice: {
        id: this.createExternalId(title, publishedAtIso, linkUrl, index),
        title,
        content,
        text: content || title,
        status: '外部新闻',
        publishAt: formatDateTime(publishedAt),
        pollingEnabled: '是',
        source: 'external',
        linkUrl: linkUrl || undefined,
        imageUrl: imageUrl || undefined,
        publishedAtIso,
        sortTimestamp: publishedAt?.getTime() ?? Date.now() - index,
      },
      rawPayload: record,
    }
  }

  private parseDate(...values: unknown[]) {
    for (const value of values) {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value
      }

      if (typeof value === 'number') {
        const date = new Date(value)
        if (!Number.isNaN(date.getTime())) {
          return date
        }
      }

      if (typeof value === 'string' && value.trim()) {
        const date = new Date(value)
        if (!Number.isNaN(date.getTime())) {
          return date
        }
      }
    }

    return null
  }

  private createExternalId(title: string, publishedAt: string | null, linkUrl: string, index: number) {
    const hash = createHash('sha1')
      .update([title, publishedAt || '', linkUrl || '', String(index)].join('|'))
      .digest('hex')
      .slice(0, 12)

    return `news_${hash}`
  }

  private async saveDatabaseCache(notices: RemoteNotice[], sourceUrl: string) {
    const fetchedAt = new Date()
    await this.prisma.$transaction([
      this.prisma.newsCache.deleteMany(),
      this.prisma.newsCache.createMany({
        data: notices.map((item) => ({
          title: item.notice.title,
          summary: item.notice.content,
          source: sourceUrl,
          url: item.notice.linkUrl ?? null,
          publishedAt: item.notice.publishedAtIso ? new Date(item.notice.publishedAtIso) : null,
          fetchedAt,
          rawPayload: item.rawPayload as Prisma.InputJsonValue,
        })),
      }),
    ])
  }

  private async readDatabaseCache(): Promise<NoticeFeedResult> {
    const dbRows = await this.prisma.newsCache.findMany({
      orderBy: [{ publishedAt: 'desc' }, { fetchedAt: 'desc' }],
      take: 10,
    })

    if (!dbRows.length) {
      return {
        notices: [],
        meta: {
          source: 'disabled',
          cachedAt: null,
        },
      }
    }

    const fetchedAt = dbRows[0].fetchedAt
    const isFresh = Date.now() - fetchedAt.getTime() < NEWS_CACHE_TTL_MS

    return {
      notices: dbRows.map((item, index) => ({
        id: this.createExternalId(item.title, item.publishedAt?.toISOString() ?? null, item.url ?? '', index),
        title: item.title,
        content: item.summary,
        text: item.summary || item.title,
        status: '外部新闻缓存',
        publishAt: formatDateTime(item.publishedAt),
        pollingEnabled: '是',
        source: 'external',
        linkUrl: item.url ?? undefined,
        publishedAtIso: item.publishedAt?.toISOString() ?? null,
        sortTimestamp: item.publishedAt?.getTime() ?? item.fetchedAt.getTime(),
      })),
      meta: {
        source: 'db-cache',
        code: isFresh ? undefined : NEWS_ERROR_CODES.DB_CACHE_FALLBACK,
        cachedAt: formatDateTime(fetchedAt),
      },
    }
  }

  private async handleFetchFailure(error: unknown, reason: 'request' | 'startup' | 'schedule'): Promise<NoticeFeedResult> {
    const message = error instanceof Error ? error.message : String(error)
    this.logger.error(`[${NEWS_ERROR_CODES.FETCH_FAILED}] 新闻源拉取失败 (${reason}): ${message}`)

    const dbCacheResult = await this.readDatabaseCache()
    if (dbCacheResult.notices.length) {
      this.logger.warn(
        `[${NEWS_ERROR_CODES.DB_CACHE_FALLBACK}] 外部新闻源异常，继续使用数据库缓存，cachedAt=${dbCacheResult.meta.cachedAt}`,
      )
      return {
        notices: dbCacheResult.notices,
        meta: {
          source: 'db-cache',
          code: NEWS_ERROR_CODES.DB_CACHE_FALLBACK,
          cachedAt: dbCacheResult.meta.cachedAt,
        },
      }
    }

    this.logger.warn(`[${NEWS_ERROR_CODES.LOCAL_FALLBACK}] 无可用数据库缓存，将由本地公告兜底`)
    return {
      notices: [],
      meta: {
        source: 'disabled',
        code: NEWS_ERROR_CODES.LOCAL_FALLBACK,
        cachedAt: null,
      },
    }
  }

  private logDisabled() {
    if (this.disabledLogged) {
      return
    }

    this.disabledLogged = true
    this.logger.log('未配置 NEWS_API_URL，公告接口将只返回本地公告')
  }
}
