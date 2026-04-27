import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'crypto'
import { NEWS_ERROR_CODES } from './dashboard.constants'
import { NoticeFeedResult, UnifiedNotice } from './dashboard.types'
import { formatDateTime, pickFirstString, trimText } from './dashboard.utils'

const TIANAPI_NEWS_URL = 'https://apis.tianapi.com/caijing/index'

type TianNewsItem = Record<string, unknown>

type AppNewsListItem = {
  id: string
  title: string
  date: string
  createdAt: string
  summary: string
  thumbnail: string
  cover: string
  views?: string
}

type AppNewsDetail = {
  id: string
  title: string
  date: string
  createdAt: string
  views: string
  author: string
  image: string
  cover: string
  content: string
  summary: string
  linkUrl?: string
}

type NormalizedNews = {
  notice: UnifiedNotice
  listItem: AppNewsListItem
  detail: AppNewsDetail
}

@Injectable()
export class NewsFeedService {
  private readonly logger = new Logger(NewsFeedService.name)
  private readonly detailCache = new Map<string, AppNewsDetail>()

  constructor(private readonly configService: ConfigService) {}

  async getFeed(): Promise<NoticeFeedResult> {
    const { items } = await this.fetchNewsPage(1, 10)

    return {
      notices: items.map((item) => ({ ...item.notice })),
      meta: {
        source: 'remote',
        cachedAt: formatDateTime(new Date()),
      },
    }
  }

  async getNewsList(page = 1, limit = 10) {
    const normalizedPage = Math.max(1, Number(page || 1))
    const normalizedLimit = Math.max(1, Math.min(50, Number(limit || 10)))

    const { items, total } = await this.fetchNewsPage(normalizedPage, normalizedLimit)

    return {
      items: items.map((item) => item.listItem),
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages: Math.max(1, Math.ceil(total / normalizedLimit)),
    }
  }

  async getNewsDetail(id: string) {
    const cached = this.detailCache.get(id)
    if (cached) {
      return cached
    }

    const { items } = await this.fetchNewsPage(1, 50)
    const detail = items.find((item) => item.detail.id === id)?.detail
    if (!detail) {
      throw new NotFoundException('新闻不存在')
    }
    return detail
  }

  private async fetchNewsPage(page: number, limit: number) {
    const apiKey = this.requireApiKey()
    const requestUrl = new URL(TIANAPI_NEWS_URL)
    requestUrl.searchParams.set('key', apiKey)
    requestUrl.searchParams.set('page', String(page))
    requestUrl.searchParams.set('num', String(limit))

    const response = await fetch(requestUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      const message = `[${NEWS_ERROR_CODES.FETCH_FAILED}] 财经新闻拉取失败: HTTP ${response.status}`
      this.logger.error(message)
      throw new Error(message)
    }

    const payload = (await response.json()) as Record<string, unknown>
    const code = Number(payload.code)
    if (code !== 200) {
      const message = `[${NEWS_ERROR_CODES.FETCH_FAILED}] 财经新闻拉取失败: ${String(payload.msg || 'unknown_error')}`
      this.logger.error(message)
      throw new Error(message)
    }

    const { items: rawItems, total } = this.extractTianItems(payload.result)
    const normalized = rawItems
      .map((item, index) => this.normalizeNews(item, page, limit, index))
      .filter((item): item is NormalizedNews => Boolean(item))

    if (!normalized.length) {
      const message = `[${NEWS_ERROR_CODES.EMPTY_RESPONSE}] 财经新闻接口未返回可用新闻`
      this.logger.error(message)
      throw new Error(message)
    }

    normalized.forEach((item) => {
      this.detailCache.set(item.detail.id, item.detail)
    })

    return {
      items: normalized,
      total,
    }
  }

  private requireApiKey() {
    const apiKey = this.configService.get<string>('NEWS_API_KEY')?.trim()
    if (!apiKey) {
      throw new Error(`[${NEWS_ERROR_CODES.FETCH_FAILED}] NEWS_API_KEY 未配置`)
    }

    return apiKey
  }

  private extractTianItems(result: unknown) {
    if (Array.isArray(result)) {
      return {
        items: result,
        total: result.length,
      }
    }

    if (!result || typeof result !== 'object') {
      return {
        items: [],
        total: 0,
      }
    }

    const record = result as Record<string, unknown>
    const items =
      this.pickItemArray(record.newslist) ||
      this.pickItemArray(record.list) ||
      this.pickItemArray(record.items) ||
      (this.looksLikeNewsItem(record) ? [record] : [])

    const total = this.pickTotal(record, items.length)

    return { items, total }
  }

  private pickItemArray(value: unknown) {
    return Array.isArray(value) ? value : null
  }

  private pickTotal(record: Record<string, unknown>, fallbackTotal: number) {
    const total = Number(record.allnum ?? record.total ?? record.count ?? fallbackTotal)
    return Number.isFinite(total) && total > 0 ? total : fallbackTotal
  }

  private looksLikeNewsItem(value: Record<string, unknown>) {
    return Boolean(pickFirstString(value.id, value.title, value.description))
  }

  private normalizeNews(item: TianNewsItem, page: number, limit: number, index: number): NormalizedNews | null {
    const title = pickFirstString(item.title)
    if (!title) {
      return null
    }

    const linkUrl = pickFirstString(item.url)
    const publishedAt = this.parseDate(pickFirstString(item.ctime))
    const publishedAtIso = publishedAt?.toISOString() ?? null
    const summary = trimText(pickFirstString(item.description), 180)
    const imageUrl = pickFirstString(item.picUrl)
    const author = pickFirstString(item.source) || '天行财经'
    const newsId =
      pickFirstString(item.id) ||
      this.createNewsId(title, publishedAtIso, linkUrl, (page - 1) * limit + index)

    return {
      notice: {
        id: newsId,
        title,
        content: summary,
        text: summary || title,
        status: '外部新闻',
        publishAt: formatDateTime(publishedAt),
        pollingEnabled: '是',
        source: 'external',
        linkUrl: linkUrl || undefined,
        imageUrl: imageUrl || undefined,
        publishedAtIso,
        sortTimestamp: publishedAt?.getTime() ?? Date.now() - index,
      },
      listItem: {
        id: newsId,
        title,
        date: pickFirstString(item.ctime) || formatDateTime(publishedAt),
        createdAt: publishedAtIso || '',
        summary,
        thumbnail: imageUrl,
        cover: imageUrl,
      },
      detail: {
        id: newsId,
        title,
        date: pickFirstString(item.ctime) || formatDateTime(publishedAt),
        createdAt: publishedAtIso || '',
        views: '-',
        author,
        image: imageUrl,
        cover: imageUrl,
        summary,
        linkUrl: linkUrl || undefined,
        content: this.buildDetailContent({
          title,
          summary,
          author,
          linkUrl,
        }),
      },
    }
  }

  private parseDate(value: string) {
    if (!value) {
      return null
    }

    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  private createNewsId(title: string, publishedAt: string | null, linkUrl: string, index: number) {
    const hash = createHash('sha1')
      .update([title, publishedAt || '', linkUrl || '', String(index)].join('|'))
      .digest('hex')
      .slice(0, 12)

    return `news_${hash}`
  }

  private buildDetailContent(input: { title: string; summary: string; author: string; linkUrl: string }) {
    const blocks = [
      `<p>${this.escapeHtml(input.summary || input.title)}</p>`,
      `<p>文章来源：${this.escapeHtml(input.author)}</p>`,
    ]

    if (input.linkUrl) {
      blocks.push(
        `<p>原文链接：<a href="${this.escapeHtml(input.linkUrl)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(input.linkUrl)}</a></p>`,
      )
    }

    return blocks.join('')
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

}
