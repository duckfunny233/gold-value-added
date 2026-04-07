import { describe, expect, it, jest } from '@jest/globals'
import { Prisma, TradeStatus, WithdrawalStatus } from '@prisma/client'
import { ReportService } from './report.service'

describe('ReportService admin reports', () => {
  const decimal = (value: number) => new Prisma.Decimal(value)
  const resolved = <T,>(value: T) => jest.fn<() => Promise<T>>().mockResolvedValue(value)

  it('aggregates cards and exports for finance reports', async () => {
    const prisma = {
      user: { findMany: resolved([]) },
      tradeOrder: {
        findMany: resolved([
          {
            price: decimal(560),
            quantityGrams: decimal(2),
            status: TradeStatus.FILLED,
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
          },
        ]),
      },
      rechargeOrder: {
        findMany: resolved([
          {
            amount: decimal(1000),
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
          },
        ]),
      },
      withdrawalOrder: {
        findMany: resolved([
          {
            amount: decimal(200),
            status: WithdrawalStatus.PENDING,
            createdAt: new Date('2026-04-06T10:00:00.000Z'),
          },
        ]),
      },
      hashRecord: {
        findMany: resolved([
          {
            syncStatus: 'PENDING',
            createdAt: new Date('2026-04-06T11:00:00.000Z'),
          },
        ]),
      },
      adminOperationLog: {
        findMany: resolved([]),
      },
    } as any

    const service = new ReportService(prisma)
    const result = await service.getAdminReports({ reportType: 'finance', timeRange: '7d' })

    expect(result.cards[2].value).toBe('¥1,120.00')
    expect(result.exportsList[0].name).toBe('财务日报')
  })

  const createService = () => {
    const state = {
      templates: [] as any[],
      jobs: [] as any[],
      artifacts: [] as any[],
      adminLogs: [] as any[],
      auditLogs: [] as any[],
      hashWrites: [] as any[],
    }

    const root = {
      user: { findMany: resolved([]) },
      tradeOrder: { findMany: resolved([]) },
      rechargeOrder: { findMany: resolved([]) },
      withdrawalOrder: { findMany: resolved([]) },
      hashRecord: {
        findMany: resolved([]),
        create: jest.fn(async ({ data }: any) => {
          state.hashWrites.push(data)
          return data
        }),
      },
      adminOperationLog: {
        findMany: jest.fn(async () => state.adminLogs),
        create: jest.fn(async ({ data }: any) => {
          state.adminLogs.push(data)
          return data
        }),
      },
      auditLog: {
        create: jest.fn(async ({ data }: any) => {
          state.auditLogs.push(data)
          return data
        }),
      },
      reportTemplate: {
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `tpl-${state.templates.length + 1}`,
            ...data,
            createdAt: new Date('2026-04-07T10:00:00.000Z'),
            updatedAt: new Date('2026-04-07T10:00:00.000Z'),
          }
          state.templates.push(row)
          return row
        }),
        findMany: jest.fn(async ({ where }: any = {}) =>
          state.templates.filter((item) => (where?.reportType ? item.reportType === where.reportType : true)),
        ),
        findUnique: jest.fn(async ({ where }: any) =>
          state.templates.find((item) => item.id === where.id) ?? null,
        ),
      },
      reportJob: {
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `job-${state.jobs.length + 1}`,
            ...data,
            rowCount: 0,
            errorMessage: null,
            startedAt: null,
            finishedAt: null,
            createdAt: new Date('2026-04-07T10:01:00.000Z'),
            updatedAt: new Date('2026-04-07T10:01:00.000Z'),
          }
          state.jobs.push(row)
          return row
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const target = state.jobs.find((item) => item.id === where.id)
          Object.assign(target, data, { updatedAt: new Date('2026-04-07T10:02:00.000Z') })
          return target
        }),
        findMany: jest.fn(async ({ where }: any = {}) =>
          state.jobs
            .filter((item) => (where?.reportType ? item.reportType === where.reportType : true))
            .filter((item) => (where?.status ? item.status === where.status : true))
            .map((item) => ({
              ...item,
              artifacts: state.artifacts.filter((artifact) => artifact.jobId === item.id),
              template: item.templateId ? state.templates.find((template) => template.id === item.templateId) ?? null : null,
            })),
        ),
        findUnique: jest.fn(async ({ where }: any) => {
          const item = state.jobs.find((job) => job.id === where.id)
          if (!item) {
            return null
          }
          return {
            ...item,
            artifacts: state.artifacts.filter((artifact) => artifact.jobId === item.id),
            template: item.templateId ? state.templates.find((template) => template.id === item.templateId) ?? null : null,
          }
        }),
      },
      reportArtifact: {
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: `artifact-${state.artifacts.length + 1}`,
            ...data,
            createdAt: new Date('2026-04-07T10:03:00.000Z'),
            updatedAt: new Date('2026-04-07T10:03:00.000Z'),
          }
          state.artifacts.push(row)
          return row
        }),
      },
    } as any

    const tx = {
      reportArtifact: root.reportArtifact,
      reportJob: root.reportJob,
      reportTemplate: root.reportTemplate,
      adminOperationLog: root.adminOperationLog,
      auditLog: root.auditLog,
      hashRecord: root.hashRecord,
    }

    const prisma = {
      ...root,
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any

    return {
      service: new ReportService(prisma),
      state,
    }
  }

  it('drives report job status from pending to succeeded', async () => {
    const { service, state } = createService()
    const result = await service.generateReport(
      { reportType: 'operate', timeRange: '7d', format: 'csv' },
      { adminUserId: 'admin-1', username: 'admin' },
    )

    expect(result.data.status).toBe('SUCCEEDED')
    expect(state.jobs[0].status).toBe('SUCCEEDED')
    expect(state.artifacts).toHaveLength(1)
  })

  it('saves and reads templates', async () => {
    const { service } = createService()
    await service.createTemplate(
      { name: '财务模板', reportType: 'finance', timeRange: '7d', channel: 'bank', defaultFormat: 'csv' },
      { adminUserId: 'admin-1', username: 'admin' },
    )

    const result = await service.getTemplates({ reportType: 'finance' })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].name).toBe('财务模板')
  })

  it('exports generated job as csv', async () => {
    const { service } = createService()
    const generated = await service.generateReport(
      { reportType: 'operate', timeRange: 'today', format: 'csv' },
      { adminUserId: 'admin-1', username: 'admin' },
    )

    const result = await service.exportJob(
      generated.data.jobId,
      { format: 'csv' },
      { adminUserId: 'admin-1', username: 'admin' },
    )

    expect(result.data.fileName).toContain('.csv')
    expect(result.data.content).toContain('metric,value')
  })

  it('validates export format', async () => {
    const { service } = createService()
    const generated = await service.generateReport(
      { reportType: 'operate', timeRange: '7d', format: 'csv' },
      { adminUserId: 'admin-1', username: 'admin' },
    )

    await expect(
      service.exportJob(
        generated.data.jobId,
        { format: 'pdf' as any },
        { adminUserId: 'admin-1', username: 'admin' },
      ),
    ).rejects.toThrow('仅支持 csv 或 excel 导出')
  })
})
