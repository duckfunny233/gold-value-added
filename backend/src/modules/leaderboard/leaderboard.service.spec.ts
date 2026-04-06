import { describe, expect, it, jest } from '@jest/globals'
import { LeaderboardJobStatus, LeaderboardRule, Prisma } from '@prisma/client'
import { LeaderboardService } from './leaderboard.service'

describe('LeaderboardService V1', () => {
  const decimal = (value: number) => new Prisma.Decimal(value)

  const createService = () => {
    const state = {
      config: null as any,
      jobs: [] as any[],
      snapshots: [] as any[],
      users: [] as any[],
      hashRecords: [] as any[],
      adminOperations: [] as any[],
      auditLogs: [] as any[],
      hashWrites: [] as any[],
    }

    const root = {
      leaderboardConfig: {
        upsert: jest.fn(async ({ create, update }: any) => {
          const now = new Date()
          if (!state.config) {
            state.config = {
              id: 'cfg-1',
              scope: 'default',
              currentRule: create.currentRule,
              traceId: create.traceId ?? null,
              createdAt: now,
              updatedAt: now,
            }
          } else {
            state.config = {
              ...state.config,
              ...update,
              updatedAt: now,
            }
          }
          return state.config
        }),
      },
      leaderboardJob: {
        create: jest.fn(async ({ data }: any) => {
          const now = new Date()
          const row = {
            id: `job-${state.jobs.length + 1}`,
            version: data.version,
            rule: data.rule,
            status: data.status,
            traceId: data.traceId,
            totalRows: 0,
            failedRows: 0,
            errorMessage: null,
            startedAt: now,
            finishedAt: null,
            createdAt: now,
            updatedAt: now,
          }
          state.jobs.push(row)
          return row
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const target = state.jobs.find((item) => item.id === where.id)
          Object.assign(target, data, { updatedAt: new Date() })
          return target
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          const filtered = state.jobs
            .filter((item) => (where.rule ? item.rule === where.rule : true))
            .filter((item) =>
              where.status?.in ? where.status.in.includes(item.status) : true,
            )
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          return filtered[0] ?? null
        }),
      },
      leaderboardSnapshot: {
        createMany: jest.fn(async ({ data }: any) => {
          data.forEach((item: any, index: number) => {
            state.snapshots.push({
              id: `snap-${state.snapshots.length + index + 1}`,
              createdAt: new Date(),
              ...item,
            })
          })
          return { count: data.length }
        }),
        findMany: jest.fn(async ({ where }: any) => {
          return state.snapshots
            .filter((item) => item.jobId === where.jobId)
            .filter((item) => (where.uid?.contains ? item.uid.includes(where.uid.contains) : true))
            .filter((item) => (where.syncStatus ? item.syncStatus === where.syncStatus : true))
            .filter((item) => (where.updatedAt?.gte ? item.updatedAt >= where.updatedAt.gte : true))
            .sort((left, right) => left.rank - right.rank)
        }),
      },
      user: {
        findMany: jest.fn(async () => state.users),
      },
      hashRecord: {
        findMany: jest.fn(async () => state.hashRecords),
        create: jest.fn(async ({ data }: any) => {
          state.hashWrites.push(data)
          return data
        }),
      },
      adminOperationLog: {
        create: jest.fn(async ({ data }: any) => {
          state.adminOperations.push(data)
          return data
        }),
      },
      auditLog: {
        create: jest.fn(async ({ data }: any) => {
          state.auditLogs.push(data)
          return data
        }),
      },
    } as any

    const tx = {
      leaderboardConfig: root.leaderboardConfig,
      leaderboardJob: root.leaderboardJob,
      leaderboardSnapshot: root.leaderboardSnapshot,
      adminOperationLog: root.adminOperationLog,
      auditLog: root.auditLog,
      hashRecord: root.hashRecord,
    }

    const prisma = {
      ...root,
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any

    return {
      service: new LeaderboardService(prisma),
      prisma,
      state,
    }
  }

  it('sorts by goldHoldingGrams correctly', async () => {
    const { service, state } = createService()
    state.users = [
      { uid: 'U0001002', username: 'u2', nickname: '用户2', asset: { goldHoldingGrams: decimal(12), totalAsset: decimal(1000) } },
      { uid: 'U0001001', username: 'u1', nickname: '用户1', asset: { goldHoldingGrams: decimal(18), totalAsset: decimal(900) } },
      { uid: 'U0001003', username: 'u3', nickname: '用户3', asset: { goldHoldingGrams: decimal(10), totalAsset: decimal(1100) } },
    ]

    await service.rebuild({ sortRule: 'goldHoldingGrams' }, { adminUserId: 'admin-1', username: 'admin' })
    const overview = await service.getOverview({ sortRule: 'goldHoldingGrams' })

    expect(overview.rows.map((item) => item.uid)).toEqual(['U0001001', 'U0001002', 'U0001003'])
  })

  it('sorts by totalAsset correctly', async () => {
    const { service, state } = createService()
    state.users = [
      { uid: 'U0001002', username: 'u2', nickname: '用户2', asset: { goldHoldingGrams: decimal(12), totalAsset: decimal(1000) } },
      { uid: 'U0001001', username: 'u1', nickname: '用户1', asset: { goldHoldingGrams: decimal(18), totalAsset: decimal(900) } },
      { uid: 'U0001003', username: 'u3', nickname: '用户3', asset: { goldHoldingGrams: decimal(10), totalAsset: decimal(2100) } },
    ]

    await service.rebuild({ sortRule: 'totalAsset' }, { adminUserId: 'admin-1', username: 'admin' })
    const overview = await service.getOverview({ sortRule: 'totalAsset' })

    expect(overview.rows.map((item) => item.uid)).toEqual(['U0001003', 'U0001002', 'U0001001'])
  })

  it('keeps stable uid ordering when values are equal', async () => {
    const { service, state } = createService()
    state.users = [
      { uid: 'U0001002', username: 'u2', nickname: '用户2', asset: { goldHoldingGrams: decimal(18), totalAsset: decimal(1000) } },
      { uid: 'U0001001', username: 'u1', nickname: '用户1', asset: { goldHoldingGrams: decimal(18), totalAsset: decimal(1000) } },
    ]

    await service.rebuild({ sortRule: 'goldHoldingGrams' }, { adminUserId: 'admin-1', username: 'admin' })
    const overview = await service.getOverview({ sortRule: 'goldHoldingGrams' })

    expect(overview.rows.map((item) => item.uid)).toEqual(['U0001001', 'U0001002'])
  })

  it('tracks rebuild status flow from rebuilding to failed', async () => {
    const { service, prisma, state } = createService()
    state.users = [
      { uid: 'U0001001', username: 'u1', nickname: '用户1', asset: { goldHoldingGrams: decimal(18), totalAsset: decimal(1000) } },
    ]
    state.hashRecords = [
      {
        tradeOrder: { user: { uid: 'U0001001' } },
        rechargeOrder: null,
        withdrawalOrder: null,
      },
    ]

    await service.rebuild({ sortRule: 'goldHoldingGrams' }, { adminUserId: 'admin-1', username: 'admin' })

    expect(prisma.leaderboardJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: LeaderboardJobStatus.REBUILDING,
        }),
      }),
    )
    expect(prisma.leaderboardJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: LeaderboardJobStatus.FAILED,
        }),
      }),
    )
  })

  it('repairs exception rows on retry-sync', async () => {
    const { service, state } = createService()
    state.users = [
      { uid: 'U0001001', username: 'u1', nickname: '用户1', asset: { goldHoldingGrams: decimal(18), totalAsset: decimal(1000) } },
    ]
    state.hashRecords = [
      {
        tradeOrder: { user: { uid: 'U0001001' } },
        rechargeOrder: null,
        withdrawalOrder: null,
      },
    ]

    await service.rebuild({ sortRule: 'goldHoldingGrams' }, { adminUserId: 'admin-1', username: 'admin' })
    let overview = await service.getOverview({ sortRule: 'goldHoldingGrams', syncStatus: 'exception' })
    expect(overview.rows).toHaveLength(1)

    state.hashRecords = []
    await service.retrySync({ sortRule: 'goldHoldingGrams' }, { adminUserId: 'admin-1', username: 'admin' })
    overview = await service.getOverview({ sortRule: 'goldHoldingGrams' })

    expect(overview.rows[0].syncStatus).toBe('已同步')
  })
})
