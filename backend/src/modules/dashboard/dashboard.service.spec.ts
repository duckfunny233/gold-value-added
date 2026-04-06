import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { ConfigService } from '@nestjs/config'
import { NoticeStatus } from '@prisma/client'
import { DashboardService } from './dashboard.service'
import { NewsFeedService } from './news-feed.service'

describe('DashboardService notices', () => {
  const originalFetch = global.fetch
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)

  const createPrismaMock = (localNotices: Array<Record<string, unknown>> = []) =>
    ({
      notice: {
        findMany: resolved(localNotices),
        create: jest.fn() as any,
      },
      withdrawalOrder: { count: resolved(0), findMany: resolved([]) },
      rechargeOrder: {
        count: resolved(0),
        findMany: resolved([]),
      },
      user: { count: resolved(0), findMany: resolved([]) },
      tradeOrder: {
        count: resolved(0),
        aggregate: resolved({ _avg: { price: null } }),
      },
      newsCache: {
        findMany: resolved([]),
        deleteMany: jest.fn() as any,
        createMany: jest.fn() as any,
      },
      hashRecord: { findMany: resolved([]) },
      auditLog: { findMany: resolved([]) },
      adminOperationLog: { findMany: resolved([]) },
      $transaction: jest.fn(async (items: Array<Promise<unknown> | unknown>) => Promise.all(items as any)) as any,
    }) as any

  const createLocalNotice = () => [
    {
      id: 'local_notice_1',
      title: '本地公告',
      content: '本地公告兜底内容',
      status: NoticeStatus.PUBLISHED,
      publishedAt: new Date('2026-04-06T09:00:00.000Z'),
      updatedAt: new Date('2026-04-06T09:00:00.000Z'),
    },
  ]

  beforeEach(() => {
    jest.restoreAllMocks()
    global.fetch = (jest.fn() as any)
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('returns merged notices when external feed succeeds', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({
        items: [
          {
            title: '外部新闻',
            summary: '外部新闻摘要',
            publishedAt: '2026-04-06T10:00:00.000Z',
            url: 'https://news.example.com/1',
          },
        ],
      }),
    })

    const prisma = createPrismaMock(createLocalNotice())
    const newsFeedService = new NewsFeedService(
      new ConfigService({ NEWS_API_URL: 'https://news.example.com' }),
      prisma,
    )
    const dashboardService = new DashboardService(prisma, newsFeedService)

    const result = await dashboardService.getAppNoticeFeed()

    expect(result.meta.source).toBe('remote')
    expect(result.notices).toHaveLength(2)
    expect(result.notices[0].title).toBe('外部新闻')
    expect(result.notices[1].title).toBe('本地公告')
  })

  it('falls back to database cached notices when refresh fails', async () => {
    ;(global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({
          items: [
            {
              title: '缓存新闻',
              summary: '缓存新闻摘要',
              publishedAt: '2026-04-06T10:00:00.000Z',
            },
          ],
        }),
      })
      .mockRejectedValueOnce(new Error('upstream failed'))

    const prisma = createPrismaMock(createLocalNotice())
    prisma.newsCache.findMany = resolved([
      {
        id: 'db-cache-1',
        title: '数据库缓存新闻',
        summary: '数据库缓存摘要',
        source: 'https://news.example.com',
        url: 'https://news.example.com/1',
        publishedAt: new Date('2026-04-06T10:00:00.000Z'),
        fetchedAt: new Date('2026-04-06T10:01:00.000Z'),
        rawPayload: { title: '数据库缓存新闻' },
      },
    ])
    const newsFeedService = new NewsFeedService(
      new ConfigService({ NEWS_API_URL: 'https://news.example.com' }),
      prisma,
    )
    const dashboardService = new DashboardService(prisma, newsFeedService)

    const first = await dashboardService.getAppNoticeFeed()
    expect(first.meta.source).toBe('remote')

    const second = await dashboardService.getAppNoticeFeed()

    expect(second.meta.source).toBe('db-cache')
    expect(second.meta.code).toBe('NEWS_DB_CACHE_FALLBACK')
    expect(second.notices[0].title).toBe('数据库缓存新闻')
  })

  it('falls back to local notices when external feed fails without cache', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('upstream failed'))

    const prisma = createPrismaMock(createLocalNotice())
    const newsFeedService = new NewsFeedService(
      new ConfigService({ NEWS_API_URL: 'https://news.example.com' }),
      prisma,
    )
    const dashboardService = new DashboardService(prisma, newsFeedService)

    const result = await dashboardService.getAppNoticeFeed()

    expect(result.meta.source).toBe('local')
    expect(result.meta.code).toBe('NEWS_LOCAL_FALLBACK')
    expect(result.notices).toHaveLength(1)
    expect(result.notices[0].title).toBe('本地公告')
  })
})
