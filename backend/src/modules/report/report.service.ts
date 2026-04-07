import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, ReportArtifactFormat, ReportJobStatus, TradeStatus, WithdrawalStatus } from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  formatCurrency,
  formatDateTime,
  formatGrams,
  formatInteger,
  formatPercent,
  getJsonRecord,
  resolveAdminTimeRange,
  toNumber,
} from '../../common/utils/admin-view.util'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import {
  AdminReportsQueryDto,
  ReportGenerateDto,
  ReportJobExportDto,
  ReportJobsQueryDto,
  ReportTemplateCreateDto,
  ReportTemplatesQueryDto,
} from './report.dto'

const WITHDRAW_AUDIT_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.PENDING,
  WithdrawalStatus.REVIEWING,
  WithdrawalStatus.APPROVED,
]

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReport(body: ReportGenerateDto, actor: AdminActor) {
    const resolved = await this.resolveReportRequest(body)
    const traceId = randomUUID()
    const createdJob = await this.prisma.reportJob.create({
      data: {
        reportType: resolved.reportType,
        status: ReportJobStatus.PENDING,
        filters: resolved.filters as Prisma.InputJsonValue,
        requestedFormat: this.mapFormatEnum(resolved.format),
        traceId,
        templateId: resolved.templateId,
        createdByAdminUserId: actor.adminUserId,
      },
    })

    try {
      await this.prisma.reportJob.update({
        where: {
          id: createdJob.id,
        },
        data: {
          status: ReportJobStatus.RUNNING,
          startedAt: new Date(),
        },
      })

      const dataset = await this.buildReportDataset(resolved.reportType, resolved.filters)
      const artifact = this.buildArtifact(createdJob.id, traceId, resolved.reportType, resolved.format, dataset.rows)

      await this.prisma.$transaction(async (tx) => {
        await tx.reportArtifact.create({
          data: artifact,
        })

        await tx.reportJob.update({
          where: {
            id: createdJob.id,
          },
          data: {
            status: ReportJobStatus.SUCCEEDED,
            rowCount: dataset.rows.length,
            finishedAt: new Date(),
          },
        })

        await this.writeReportOperation(tx, {
          actor,
          action: 'report.job.generate',
          traceId,
          referenceType: 'REPORT_JOB_GENERATE',
          referenceId: createdJob.id,
          payload: {
            jobId: createdJob.id,
            reportType: resolved.reportType,
            format: resolved.format,
            filters: resolved.filters,
            rowCount: dataset.rows.length,
            result: '成功',
          },
        })
      })

      return {
        message: '报表任务生成成功',
        data: {
          jobId: createdJob.id,
          traceId,
          reportType: resolved.reportType,
          status: 'SUCCEEDED',
          rowCount: dataset.rows.length,
          format: resolved.format,
        },
      }
    } catch (error) {
      await this.prisma.reportJob.update({
        where: {
          id: createdJob.id,
        },
        data: {
          status: ReportJobStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        },
      })
      throw error
    }
  }

  async getJobs(query: ReportJobsQueryDto) {
    const jobs: any[] = await this.prisma.reportJob.findMany({
      where: {
        ...(query.reportType ? { reportType: query.reportType } : {}),
        ...(query.status ? { status: query.status as ReportJobStatus } : {}),
      },
      include: {
        artifacts: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        template: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      rows: jobs.map((item: any) => ({
        jobId: item.id,
        reportType: item.reportType,
        status: item.status,
        rowCount: item.rowCount,
        requestedFormat: this.mapFormatValue(item.requestedFormat),
        templateName: item.template?.name || '',
        traceId: item.traceId,
        createdAt: formatDateTime(item.createdAt),
        startedAt: formatDateTime(item.startedAt),
        finishedAt: formatDateTime(item.finishedAt),
        artifactCount: item.artifacts.length,
      })),
    }
  }

  async getJobDetail(jobId: string) {
    const job: any = await this.prisma.reportJob.findUnique({
      where: {
        id: jobId,
      },
      include: {
        artifacts: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        template: true,
      },
    })

    if (!job) {
      throw new NotFoundException('报表任务不存在')
    }

    return {
      jobId: job.id,
      reportType: job.reportType,
      status: job.status,
      rowCount: job.rowCount,
      traceId: job.traceId,
      filters: job.filters,
      template: job.template
        ? {
            templateId: job.template.id,
            name: job.template.name,
            defaultFormat: this.mapFormatValue(job.template.defaultFormat),
          }
        : null,
      artifacts: job.artifacts.map((item: any) => ({
        artifactId: item.id,
        format: this.mapFormatValue(item.format),
        fileName: item.fileName,
        mimeType: item.mimeType,
        size: Buffer.byteLength(item.content, 'utf8'),
        rowCount: item.rowCount,
        traceId: item.traceId,
        createdAt: formatDateTime(item.createdAt),
      })),
      createdAt: formatDateTime(job.createdAt),
      startedAt: formatDateTime(job.startedAt),
      finishedAt: formatDateTime(job.finishedAt),
      errorMessage: job.errorMessage || '',
    }
  }

  async exportJob(jobId: string, body: ReportJobExportDto, actor: AdminActor) {
    const format = (body.format || 'csv').toLowerCase()
    if (!['csv', 'excel'].includes(format)) {
      throw new BadRequestException('仅支持 csv 或 excel 导出')
    }

    const job: any = await this.prisma.reportJob.findUnique({
      where: {
        id: jobId,
      },
      include: {
        artifacts: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!job) {
      throw new NotFoundException('报表任务不存在')
    }
    if (job.status !== ReportJobStatus.SUCCEEDED) {
      throw new BadRequestException('仅成功任务支持导出')
    }

    let artifact = job.artifacts.find((item: any) => this.mapFormatValue(item.format) === format)
    if (!artifact) {
      const traceId = randomUUID()
      const created: any = await this.prisma.$transaction(async (tx) => {
        const placeholder = await tx.reportArtifact.create({
          data: {
            jobId: job.id,
            format: this.mapFormatEnum(format),
            fileName: `report-${job.reportType}-${job.id}.${format === 'excel' ? 'xlsx' : format}`,
            mimeType:
              format === 'excel'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv; charset=utf-8',
            content: format === 'excel' ? '当前版本仅支持 CSV 实际导出，Excel 为占位产物。' : '',
            rowCount: 0,
            traceId,
          },
        })

        await this.writeReportOperation(tx, {
          actor,
          action: 'report.job.export',
          traceId,
          referenceType: 'REPORT_JOB_EXPORT',
          referenceId: job.id,
          payload: {
            jobId: job.id,
            format,
            result: '成功',
            placeholder: format === 'excel',
          },
        })

        return createdArtifactShape(created)
      })
      artifact = created as any
    } else {
      const traceId = randomUUID()
      await this.writeReportOperation(this.prisma, {
        actor,
        action: 'report.job.export',
        traceId,
        referenceType: 'REPORT_JOB_EXPORT',
        referenceId: job.id,
        payload: {
          jobId: job.id,
          format,
          result: '成功',
          reusedArtifactId: artifact.id,
        },
      })
    }

    return {
      message: '报表导出成功',
      data: {
        jobId: job.id,
        artifactId: artifact.id,
        format,
        fileName: artifact.fileName,
        contentType: artifact.mimeType,
        size: Buffer.byteLength(artifact.content, 'utf8'),
        rowCount: artifact.rowCount,
        traceId: artifact.traceId,
        content: artifact.content,
      },
    }
  }

  async createTemplate(body: ReportTemplateCreateDto, actor: AdminActor) {
    const traceId = randomUUID()
    const filters = this.normalizeFilters(body)

    const template = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reportTemplate.create({
        data: {
          name: body.name.trim(),
          reportType: body.reportType,
          filters: filters as Prisma.InputJsonValue,
          defaultFormat: this.mapFormatEnum(body.defaultFormat || 'csv'),
          createdByAdminUserId: actor.adminUserId,
          traceId,
        },
      })

      await this.writeReportOperation(tx, {
        actor,
        action: 'report.template.create',
        traceId,
        referenceType: 'REPORT_TEMPLATE_CREATE',
        referenceId: created.id,
        payload: {
          templateId: created.id,
          name: created.name,
          reportType: created.reportType,
          filters,
          defaultFormat: body.defaultFormat || 'csv',
          result: '成功',
        },
      })

      return created
    })

    return {
      message: '报表模板保存成功',
      data: {
        templateId: template.id,
        traceId,
        name: template.name,
        reportType: template.reportType,
        filters,
        defaultFormat: this.mapFormatValue(template.defaultFormat),
      },
    }
  }

  async getTemplates(query: ReportTemplatesQueryDto) {
    const templates: any[] = await this.prisma.reportTemplate.findMany({
      where: {
        ...(query.reportType ? { reportType: query.reportType } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      rows: templates.map((item: any) => ({
        templateId: item.id,
        name: item.name,
        reportType: item.reportType,
        filters: item.filters,
        defaultFormat: this.mapFormatValue(item.defaultFormat),
        traceId: item.traceId || '',
        createdAt: formatDateTime(item.createdAt),
      })),
    }
  }

  async getAdminReports(query: AdminReportsQueryDto) {
    const range = resolveAdminTimeRange(query.timeRange)

    const [users, trades, recharges, withdrawals, hashes, adminLogs] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          ...(query.uid ? { uid: { contains: query.uid, mode: 'insensitive' } } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.tradeOrder.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.rechargeOrder.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
          ...(query.channel ? { channel: query.channel } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.withdrawalOrder.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
          ...(query.channel ? this.buildWithdrawalChannelFilter(query.channel) : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.hashRecord.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.adminOperationLog.findMany({
        where: {
          ...(range ? { createdAt: range } : {}),
          module: {
            in: ['report', 'fund', 'risk', 'trade'],
          },
        },
        include: {
          adminUser: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      }),
    ])

    const filledTrades = trades.filter((item) => item.status === TradeStatus.FILLED)
    const tradeVolume = filledTrades.reduce((sum, item) => sum + toNumber(item.quantityGrams), 0)
    const tradeAmount = filledTrades.reduce(
      (sum, item) => sum + toNumber(item.quantityGrams) * toNumber(item.price),
      0,
    )
    const fundFlowAmount =
      recharges.reduce((sum, item) => sum + toNumber(item.amount), 0) +
      withdrawals.reduce((sum, item) => sum + toNumber(item.amount), 0)
    const withdrawAuditCount = withdrawals.filter((item) => WITHDRAW_AUDIT_STATUSES.includes(item.status)).length
    const syncExceptionCount = hashes.filter((item) => item.syncStatus !== 'SYNCED').length

    const metrics = [
      users.length,
      tradeVolume,
      tradeAmount,
      fundFlowAmount,
      withdrawAuditCount,
      syncExceptionCount,
    ]
    const maxMetric = Math.max(...metrics, 1)

    return {
      cards: [
        {
          key: 'userGrowth',
          label: '用户增长数',
          value: formatInteger(users.length),
          rate: formatPercent((users.length / maxMetric) * 100),
        },
        {
          key: 'tradeVolume',
          label: '成交总克数',
          value: formatGrams(tradeVolume),
          rate: formatPercent((tradeVolume / maxMetric) * 100),
        },
        {
          key: 'tradeAmount',
          label: '成交总金额',
          value: formatCurrency(tradeAmount),
          rate: formatPercent((tradeAmount / maxMetric) * 100),
        },
        {
          key: 'fundFlowAmount',
          label: '资金流水金额',
          value: formatCurrency(fundFlowAmount),
          rate: formatPercent((fundFlowAmount / maxMetric) * 100),
        },
        {
          key: 'withdrawAuditCount',
          label: '提现审核笔数',
          value: formatInteger(withdrawAuditCount),
          rate: formatPercent((withdrawAuditCount / maxMetric) * 100),
        },
        {
          key: 'syncExceptionCount',
          label: '同步异常笔数',
          value: formatInteger(syncExceptionCount),
          rate: formatPercent((syncExceptionCount / maxMetric) * 100),
        },
      ],
      exportsList: this.buildExportsList(query.reportType, query.timeRange, adminLogs, {
        users,
        trades,
        recharges,
        withdrawals,
        hashes,
      }),
    }
  }

  getOverview() {
    return {
      todayRechargeAmount: 128000,
      todayWithdrawAmount: 43000,
      todayTradeVolumeGrams: 552.4,
      totalUsers: 1288,
    }
  }

  private async resolveReportRequest(body: ReportGenerateDto) {
    if (body.templateId) {
      const template: any = await this.prisma.reportTemplate.findUnique({
        where: {
          id: body.templateId,
        },
      })
      if (!template) {
        throw new NotFoundException('报表模板不存在')
      }
      return {
        reportType: body.reportType || template.reportType,
        format: body.format || this.mapFormatValue(template.defaultFormat),
        filters: {
          ...getJsonRecord(template.filters),
          ...this.normalizeFilters(body),
        },
        templateId: template.id,
      }
    }

    if (!body.reportType) {
      throw new BadRequestException('生成报表时必须指定 reportType 或 templateId')
    }

    return {
      reportType: body.reportType,
      format: body.format || 'csv',
      filters: this.normalizeFilters(body),
      templateId: null,
    }
  }

  private normalizeFilters(input: {
    timeRange?: string
    uid?: string
    channel?: string
  }) {
    return {
      ...(input.timeRange ? { timeRange: input.timeRange } : {}),
      ...(input.uid ? { uid: input.uid } : {}),
      ...(input.channel ? { channel: input.channel } : {}),
    }
  }

  private async buildReportDataset(reportType: string, filters: Record<string, unknown>) {
    const timeRange =
      filters.timeRange === 'today' || filters.timeRange === '7d' || filters.timeRange === '30d'
        ? filters.timeRange
        : undefined
    const query: AdminReportsQueryDto = {
      reportType,
      timeRange,
      uid: typeof filters.uid === 'string' ? filters.uid : undefined,
      channel: typeof filters.channel === 'string' ? filters.channel : undefined,
    }

    const [users, trades, recharges, withdrawals, hashes, adminLogs] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
          ...(query.uid ? { uid: { contains: query.uid, mode: 'insensitive' } } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.tradeOrder.findMany({
        where: {
          ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.rechargeOrder.findMany({
        where: {
          ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
          ...(query.channel ? { channel: query.channel } : {}),
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.withdrawalOrder.findMany({
        where: {
          ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
          ...(query.uid ? { user: { uid: { contains: query.uid, mode: 'insensitive' } } } : {}),
          ...(query.channel ? this.buildWithdrawalChannelFilter(query.channel) : {}),
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.hashRecord.findMany({
        where: {
          ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.adminOperationLog.findMany({
        where: {
          ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
          module: {
            in: ['report', 'fund', 'risk', 'trade', 'audit'],
          },
        },
        include: {
          adminUser: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      }),
    ])

    const rows =
      reportType === 'finance'
        ? [
            ...recharges.map((item) => ({
              businessType: 'recharge',
              uid: item.user?.uid || '',
              channel: item.channel,
              amount: toNumber(item.amount),
              status: item.status,
              createdAt: formatDateTime(item.createdAt),
            })),
            ...withdrawals.map((item) => ({
              businessType: 'withdrawal',
              uid: item.user?.uid || '',
              channel: this.resolveWithdrawalChannel(item),
              amount: toNumber(item.amount),
              status: item.status,
              createdAt: formatDateTime(item.createdAt),
            })),
          ]
        : reportType === 'risk'
          ? [
              ...hashes
                .filter((item) => item.syncStatus !== 'SYNCED')
                .map((item) => ({
                  riskType: 'hash_sync',
                  referenceType: item.referenceType,
                  referenceId: item.referenceId,
                  syncStatus: item.syncStatus,
                  createdAt: formatDateTime(item.createdAt),
                })),
              ...withdrawals
                .filter((item) => WITHDRAW_AUDIT_STATUSES.includes(item.status))
                .map((item) => ({
                  riskType: 'withdraw_review',
                  uid: item.user?.uid || '',
                  amount: toNumber(item.amount),
                  status: item.status,
                  createdAt: formatDateTime(item.createdAt),
                })),
            ]
          : [
              {
                metric: 'userCount',
                value: users.length,
              },
              {
                metric: 'filledTradeCount',
                value: trades.filter((item) => item.status === TradeStatus.FILLED).length,
              },
              {
                metric: 'rechargeCount',
                value: recharges.length,
              },
              {
                metric: 'withdrawalCount',
                value: withdrawals.length,
              },
              {
                metric: 'adminOperationCount',
                value: adminLogs.length,
              },
            ]

    return {
      rows,
    }
  }

  private buildArtifact(
    jobId: string,
    traceId: string,
    reportType: string,
    format: string,
    rows: Record<string, unknown>[],
  ) {
    return {
      jobId,
      format: this.mapFormatEnum(format),
      fileName: `report-${reportType}-${jobId}.${format === 'excel' ? 'xlsx' : format}`,
      mimeType:
        format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
      content: format === 'excel' ? '当前版本仅支持 CSV 实际导出，Excel 为占位产物。' : this.toCsv(rows),
      rowCount: rows.length,
      traceId,
    }
  }

  private buildExportsList(
    reportType: string | undefined,
    timeRange: string | undefined,
    logs: Array<{
      action: string
      createdAt: Date
      payload: unknown
      adminUser: { username: string; displayName: string | null } | null
    }>,
    datasets: {
      users: Array<{ createdAt: Date }>
      trades: Array<{ createdAt: Date; status: TradeStatus }>
      recharges: Array<{ createdAt: Date }>
      withdrawals: Array<{ createdAt: Date; status: WithdrawalStatus }>
      hashes: Array<{ createdAt: Date; syncStatus: string }>
    },
  ) {
    const normalizedType = (reportType || 'operate').toLowerCase()
    const templates =
      normalizedType === 'finance'
        ? [
            { name: '财务日报', modules: '资金/审计' },
            { name: '渠道对账表', modules: '资金/支付渠道' },
            { name: '提现审核表', modules: '资金/风控' },
          ]
        : normalizedType === 'risk'
          ? [
              { name: '风控追踪表', modules: '风控/交易' },
              { name: '冻结拦截表', modules: '风控/用户' },
              { name: '审计追溯表', modules: '风控/审计' },
            ]
          : [
              { name: '运营周报', modules: '用户/交易/资金' },
              { name: '交易活跃报表', modules: '交易/资金' },
              { name: '用户增长快照', modules: '用户/运营' },
            ]

    const latestLog = logs[0]
    const generatedBy =
      latestLog?.adminUser?.displayName || latestLog?.adminUser?.username || '系统'
    const aggregationRule = this.mapAggregationRule(timeRange)
    const latestCreatedAt = [
      datasets.users[0]?.createdAt,
      datasets.trades[0]?.createdAt,
      datasets.recharges[0]?.createdAt,
      datasets.withdrawals[0]?.createdAt,
      datasets.hashes[0]?.createdAt,
      latestLog?.createdAt,
    ]
      .filter((item): item is Date => Boolean(item))
      .sort((left, right) => right.getTime() - left.getTime())[0]

    const pendingHashes = datasets.hashes.some((item) => item.syncStatus !== 'SYNCED')
    const pendingWithdrawals = datasets.withdrawals.some((item) => WITHDRAW_AUDIT_STATUSES.includes(item.status))

    return templates.map((item, index) => ({
      name: item.name,
      generatedAt: formatDateTime(latestCreatedAt || null),
      generatedBy,
      aggregationRule,
      dataSourceModules: item.modules,
      status:
        index === 0 && (pendingHashes || pendingWithdrawals) && normalizedType !== 'operate'
          ? '生成中'
          : '已完成',
    }))
  }

  private mapAggregationRule(timeRange?: string) {
    if (timeRange === '30d') {
      return '按月汇总'
    }
    if (timeRange === 'today') {
      return '按日汇总'
    }
    return '按周汇总'
  }

  private buildWithdrawalChannelFilter(channel: string) {
    if (channel === 'wechat') {
      return { wechatReceiptUrl: { not: null } }
    }
    if (channel === 'alipay') {
      return { alipayReceiptUrl: { not: null } }
    }
    if (channel === 'bank') {
      return {
        OR: [{ bankName: { not: null } }, { bankAccountNo: { not: null } }],
      }
    }
    return {}
  }

  private resolveWithdrawalChannel(item: {
    wechatReceiptUrl?: string | null
    alipayReceiptUrl?: string | null
    bankName?: string | null
    bankAccountNo?: string | null
  }) {
    if (item.wechatReceiptUrl) {
      return 'wechat'
    }
    if (item.alipayReceiptUrl) {
      return 'alipay'
    }
    if (item.bankName || item.bankAccountNo) {
      return 'bank'
    }
    return 'unknown'
  }

  private toCsv(rows: Record<string, unknown>[]) {
    if (rows.length === 0) {
      return 'empty\n'
    }
    const headers = Array.from(new Set(rows.flatMap((item) => Object.keys(item))))
    return [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => this.escapeCsv(row[header])).join(','),
      ),
    ].join('\n')
  }

  private escapeCsv(value: unknown) {
    const normalized =
      value == null
        ? ''
        : typeof value === 'string'
          ? value
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value)
    const escaped = normalized.replace(/"/g, '""')
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
  }

  private mapFormatEnum(format: string) {
    return format.toLowerCase() === 'excel' ? ReportArtifactFormat.EXCEL : ReportArtifactFormat.CSV
  }

  private mapFormatValue(format: ReportArtifactFormat) {
    return format === ReportArtifactFormat.EXCEL ? 'excel' : format === ReportArtifactFormat.JSON ? 'json' : 'csv'
  }

  private async writeReportOperation(
    tx: Prisma.TransactionClient | PrismaService,
    payload: {
      actor: AdminActor
      action: string
      traceId: string
      referenceType: string
      referenceId: string
      payload: Record<string, unknown>
    },
  ) {
    await tx.adminOperationLog.create({
      data: {
        adminUserId: payload.actor.adminUserId,
        module: 'report',
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload as Prisma.InputJsonValue,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: null,
        actorType: 'ADMIN',
        actorId: payload.actor.adminUserId,
        module: 'report',
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload as Prisma.InputJsonValue,
      },
    })

    await tx.hashRecord.create({
      data: {
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        traceId: payload.traceId,
        sha256: sha256(`${payload.referenceType}:${payload.referenceId}:${payload.traceId}:${JSON.stringify(payload.payload)}`),
        syncStatus: 'PENDING',
      },
    })
  }
}

type AdminActor = {
  adminUserId: string
  username: string
}

function createdArtifactShape<T extends { id: string; fileName: string; mimeType: string; content: string; rowCount: number; traceId: string }>(value: T) {
  return value
}
