import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  Asset,
  AssetChangeType,
  Prisma,
  PrismaClient,
  User,
} from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  formatCurrency,
  formatDateTime,
  formatInteger,
  resolveAdminTimeRange,
  toNumber,
} from '../../common/utils/admin-view.util'
import { sha256 } from '../../common/utils/hash.util'
import { OperationIdempotencyService } from '../../common/services/operation-idempotency.service'
import { PrismaService } from '../../prisma/prisma.service'
import {
  AdminPaymentsQueryDto,
  PaymentQrQueryDto,
  PaymentRecordsQueryDto,
  PaymentTransferDto,
} from './payment.dto'

type PaymentTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>

type UserWithAsset = User & {
  asset: Asset | null
}

const PAYMENT_SLOGAN = '金链·GYC  法币锚定金银结算系统。'

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationIdempotencyService: OperationIdempotencyService,
  ) {}

  async getQrProfile(query: PaymentQrQueryDto) {
    const user = await this.requireUserByUid(query.uid)
    const profile = await (this.prisma as any).paymentProfile.upsert({
      where: {
        userId: user.id,
      },
      create: {
        userId: user.id,
        qrPayload: this.buildQrPayload(user.uid, user.nickname || user.username),
        displayName: user.nickname || user.username,
      },
      update: {
        qrPayload: this.buildQrPayload(user.uid, user.nickname || user.username),
        displayName: user.nickname || user.username,
      },
    })

    return {
      uid: user.uid,
      displayName: profile.displayName || user.nickname || user.username,
      qrPayload: profile.qrPayload,
      slogan: PAYMENT_SLOGAN,
    }
  }

  async transfer(body: PaymentTransferDto, idempotencyKey?: string) {
    const resolvedIdempotencyKey = idempotencyKey || body.clientRequestId
    const requestPayload = {
      payerUid: body.payerUid,
      payerUsername: body.payerUsername,
      payeeUid: body.payeeUid,
      amount: body.amount,
      scene: body.scene,
      remark: body.remark || '',
    }

    if (resolvedIdempotencyKey) {
      const reserved = await this.operationIdempotencyService.reserve(
        'payment.transfer',
        resolvedIdempotencyKey,
        requestPayload,
        randomUUID(),
      )

      if (reserved.mode === 'replay') {
        const payer = await this.resolvePayer(body)
        await this.recordPaymentIdempotencyEvent(payer.id, reserved.traceId, 'payment.idempotency-hit', {
          key: resolvedIdempotencyKey,
          result: '幂等命中',
        } as Prisma.InputJsonValue)
        return reserved.responsePayload
      }

      if (reserved.mode === 'conflict') {
        const payer = await this.resolvePayer(body)
        await this.recordPaymentIdempotencyEvent(payer.id, reserved.traceId, 'payment.idempotency-conflict', {
          key: resolvedIdempotencyKey,
          result: '并发冲突',
        } as Prisma.InputJsonValue)
        throw new ConflictException('支付处理中，请勿重复提交')
      }

      try {
        const response = await this.executeTransfer(body, reserved.traceId, resolvedIdempotencyKey)
        await this.operationIdempotencyService.markSucceeded(reserved.id, reserved.traceId, response)
        return response
      } catch (error) {
        await this.operationIdempotencyService.markFailed(reserved.id, reserved.traceId, {
          message: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }

    const traceId = randomUUID()
    return this.executeTransfer(body, traceId, `trace:${traceId}`)
  }

  async getPaymentRecords(query: PaymentRecordsQueryDto) {
    const user = await this.requireUserByUid(query.uid)
    const whereRange = query.timeRange ? resolveAdminTimeRange(query.timeRange) : undefined
    const [outgoing, incoming] = await Promise.all([
      (this.prisma as any).paymentOrder.findMany({
        where: {
          payerId: user.id,
          ...(whereRange ? { createdAt: whereRange } : {}),
        },
        include: {
          payee: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      (this.prisma as any).paymentOrder.findMany({
        where: {
          payeeId: user.id,
          ...(whereRange ? { createdAt: whereRange } : {}),
        },
        include: {
          payer: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

    return {
      outgoing: outgoing.map((item: any) => ({
        orderId: item.id,
        traceId: item.traceId,
        direction: 'outgoing',
        counterpartyUid: item.payee.uid,
        counterpartyName: item.payee.nickname || item.payee.username,
        amount: Number(item.amount),
        scene: item.scene.toLowerCase(),
        status: item.status.toLowerCase(),
        remark: item.remark || '',
        createdAt: formatDateTime(item.createdAt),
      })),
      incoming: incoming.map((item: any) => ({
        orderId: item.id,
        traceId: item.traceId,
        direction: 'incoming',
        counterpartyUid: item.payer.uid,
        counterpartyName: item.payer.nickname || item.payer.username,
        amount: Number(item.amount),
        scene: item.scene.toLowerCase(),
        status: item.status.toLowerCase(),
        remark: item.remark || '',
        createdAt: formatDateTime(item.createdAt),
      })),
    }
  }

  async getAdminPayments(query: AdminPaymentsQueryDto) {
    const rows: any[] = await (this.prisma as any).paymentOrder.findMany({
      where: {
        ...(query.payerUid ? { payer: { uid: { contains: query.payerUid, mode: 'insensitive' } } } : {}),
        ...(query.payeeUid ? { payee: { uid: { contains: query.payeeUid, mode: 'insensitive' } } } : {}),
        ...(query.scene ? { scene: this.mapScene(query.scene) } : {}),
        ...(query.status ? { status: query.status === 'completed' ? 'COMPLETED' : 'FAILED' } : {}),
        ...(query.timeRange ? { createdAt: resolveAdminTimeRange(query.timeRange) } : {}),
      },
      include: {
        payer: true,
        payee: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      rows: rows.map((item: any) => ({
        orderId: item.id,
        traceId: item.traceId,
        payerUid: item.payer.uid,
        payeeUid: item.payee.uid,
        amount: Number(item.amount),
        scene: item.scene.toLowerCase(),
        status: item.status.toLowerCase(),
        createdAt: formatDateTime(item.createdAt),
      })),
    }
  }

  async getAdminOverview() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const orders: any[] = await (this.prisma as any).paymentOrder.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    const totalCount = orders.length
    const totalAmount = orders.reduce((sum: number, item: any) => sum + toNumber(item.amount), 0)
    const exceptionCount = orders.filter((item: any) => item.status !== 'COMPLETED').length
    const trend24h = Array.from({ length: 24 }).map((_, index) => {
      const bucketStart = new Date(since.getTime() + index * 60 * 60 * 1000)
      const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000)
      const bucketOrders = orders.filter((item: any) => item.createdAt >= bucketStart && item.createdAt < bucketEnd)
      return {
        hour: `${String(bucketStart.getHours()).padStart(2, '0')}:00`,
        count: bucketOrders.length,
        amount: Number(bucketOrders.reduce((sum: number, item: any) => sum + toNumber(item.amount), 0).toFixed(2)),
      }
    })

    return {
      totalCount,
      totalAmount,
      exceptionCount,
      summaryText: `近24小时支付 ${formatInteger(totalCount)} 笔 / ${formatCurrency(totalAmount)}`,
      trend24h,
    }
  }

  private async executeTransfer(body: PaymentTransferDto, traceId: string, paymentIdempotencyKey: string) {
    const amount = new Prisma.Decimal(body.amount)
    const scene = this.mapScene(body.scene)

    const result = await this.prisma.$transaction(async (tx) => {
      const payer = await this.requirePayerInTx(tx, body)
      const payee = await this.requireUserByUidInTx(tx, body.payeeUid)

      if (!payer.asset || !payee.asset) {
        throw new NotFoundException('付款方或收款方资产不存在')
      }
      if (payer.id === payee.id) {
        throw new BadRequestException('付款方与收款方不能相同')
      }

      const payerUpdatedCount = await tx.asset.updateMany({
        where: {
          userId: payer.id,
          appreciationIncome: {
            gte: amount,
          },
          totalAsset: {
            gte: amount,
          },
        },
        data: {
          appreciationIncome: {
            decrement: amount,
          },
          totalAsset: {
            decrement: amount,
          },
        },
      })

      if (payerUpdatedCount.count !== 1) {
        throw new BadRequestException('增值收益余额不足，无法完成支付')
      }

      await tx.asset.update({
        where: {
          userId: payee.id,
        },
        data: {
          appreciationIncome: {
            increment: amount,
          },
          totalAsset: {
            increment: amount,
          },
        },
      })

      const [payerAsset, payeeAsset] = await Promise.all([
        tx.asset.findUnique({ where: { userId: payer.id } }),
        tx.asset.findUnique({ where: { userId: payee.id } }),
      ])

      if (!payerAsset || !payeeAsset) {
        throw new NotFoundException('付款方或收款方资产不存在')
      }

      const paymentOrder = await (tx as any).paymentOrder.create({
        data: {
          traceId,
          payerId: payer.id,
          payeeId: payee.id,
          amount,
          scene,
          status: 'COMPLETED',
          remark: body.remark,
          idempotencyKey: paymentIdempotencyKey,
          completedAt: new Date(),
        },
      })

      await this.createLedgerEntry(tx, {
        assetId: payerAsset.id,
        userId: payer.id,
        changeType: 'PAYMENT_OUT' as any,
        amount: new Prisma.Decimal(0).minus(amount),
        traceId,
        balanceAfter: payerAsset.totalAsset,
        referenceType: 'PAYMENT_ORDER',
        referenceId: paymentOrder.id,
      })
      await this.createLedgerEntry(tx, {
        assetId: payeeAsset.id,
        userId: payee.id,
        changeType: 'PAYMENT_IN' as any,
        amount,
        traceId,
        balanceAfter: payeeAsset.totalAsset,
        referenceType: 'PAYMENT_ORDER',
        referenceId: paymentOrder.id,
      })

      await this.createAuditLog(tx, {
        userId: payer.id,
        actorType: 'USER',
        actorId: payer.id,
        module: 'payment',
        action: 'payment.transfer.out',
        traceId,
        payload: {
          payerUid: payer.uid,
          payeeUid: payee.uid,
          amount: body.amount,
          scene: body.scene,
          remark: body.remark || '',
          orderId: paymentOrder.id,
        } as Prisma.InputJsonValue,
      })
      await this.createAuditLog(tx, {
        userId: payee.id,
        actorType: 'USER',
        actorId: payer.id,
        module: 'payment',
        action: 'payment.transfer.in',
        traceId,
        payload: {
          payerUid: payer.uid,
          payeeUid: payee.uid,
          amount: body.amount,
          scene: body.scene,
          remark: body.remark || '',
          orderId: paymentOrder.id,
        } as Prisma.InputJsonValue,
      })

      await this.createHashRecord(tx, {
        referenceType: 'PAYMENT_ORDER',
        referenceId: paymentOrder.id,
        traceId,
        raw: `payment:${paymentOrder.id}:${traceId}:${payer.uid}:${payee.uid}:${body.amount}:${body.scene}:${body.remark || ''}`,
        paymentOrderId: paymentOrder.id,
      })

      return {
        paymentOrder,
        payer,
        payee,
        payerAsset,
        payeeAsset,
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    return {
      message: '支付已完成',
      data: {
        orderId: result.paymentOrder.id,
        traceId,
        payerUid: result.payer.uid,
        payeeUid: result.payee.uid,
        amount: body.amount,
        scene: body.scene,
        status: 'completed',
        remark: body.remark || '',
        payerBalance: {
          appreciationIncome: Number(result.payerAsset.appreciationIncome),
          totalAsset: Number(result.payerAsset.totalAsset),
        },
        payeeBalance: {
          appreciationIncome: Number(result.payeeAsset.appreciationIncome),
          totalAsset: Number(result.payeeAsset.totalAsset),
        },
      },
    }
  }

  private async resolvePayer(body: Pick<PaymentTransferDto, 'payerUid' | 'payerUsername'>) {
    const where = body.payerUid
      ? { uid: body.payerUid }
      : body.payerUsername
        ? { username: body.payerUsername }
        : undefined

    if (!where) {
      throw new BadRequestException('支付请求缺少付款方标识')
    }

    const user = await this.prisma.user.findFirst({
      where,
      include: {
        asset: true,
      },
    })

    if (!user) {
      throw new NotFoundException('付款方不存在')
    }

    return user
  }

  private async requirePayerInTx(tx: PaymentTx, body: Pick<PaymentTransferDto, 'payerUid' | 'payerUsername'>): Promise<UserWithAsset> {
    const where = body.payerUid
      ? { uid: body.payerUid }
      : body.payerUsername
        ? { username: body.payerUsername }
        : undefined

    if (!where) {
      throw new BadRequestException('支付请求缺少付款方标识')
    }

    const user = await tx.user.findFirst({
      where,
      include: {
        asset: true,
      },
    })

    if (!user) {
      throw new NotFoundException('付款方不存在')
    }

    return user
  }

  private async requireUserByUid(uid: string): Promise<UserWithAsset> {
    const user = await this.prisma.user.findUnique({
      where: {
        uid,
      },
      include: {
        asset: true,
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return user
  }

  private async requireUserByUidInTx(tx: PaymentTx, uid: string): Promise<UserWithAsset> {
    const user = await tx.user.findUnique({
      where: {
        uid,
      },
      include: {
        asset: true,
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return user
  }

  private mapScene(scene: 'user' | 'merchant') {
    return scene === 'merchant' ? ('MERCHANT' as any) : ('USER' as any)
  }

  private buildQrPayload(uid: string, displayName: string) {
    return `GYC-PAY://collect?uid=${encodeURIComponent(uid)}&name=${encodeURIComponent(displayName)}`
  }

  private async createLedgerEntry(
    tx: PaymentTx,
    payload: {
      assetId: string
      userId: string
      changeType: AssetChangeType
      amount: Prisma.Decimal
      traceId: string
      balanceAfter: Prisma.Decimal
      referenceType: string
      referenceId: string
    },
  ) {
    await tx.ledgerEntry.create({
      data: {
        assetId: payload.assetId,
        userId: payload.userId,
        changeType: payload.changeType,
        amount: payload.amount,
        traceId: payload.traceId,
        balanceAfter: payload.balanceAfter,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
      },
    })
  }

  private async createAuditLog(
    tx: PaymentTx,
    payload: {
      userId: string
      actorType: string
      actorId: string
      module: string
      action: string
      traceId: string
      payload: Prisma.InputJsonValue
    },
  ) {
    await tx.auditLog.create({
      data: {
        userId: payload.userId,
        actorType: payload.actorType,
        actorId: payload.actorId,
        module: payload.module,
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload,
      },
    })
  }

  private async createHashRecord(
    tx: PaymentTx,
    payload: {
      referenceType: string
      referenceId: string
      traceId: string
      raw: string
      paymentOrderId?: string
    },
  ) {
    await tx.hashRecord.create({
      data: {
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        traceId: payload.traceId,
        sha256: sha256(payload.raw),
        syncStatus: 'PENDING',
        paymentOrderId: payload.paymentOrderId,
      } as any,
    })
  }

  private async recordPaymentIdempotencyEvent(
    userId: string,
    traceId: string,
    action: string,
    payload: Prisma.InputJsonValue,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId,
          actorType: 'USER',
          actorId: userId,
          module: 'payment',
          action,
          traceId,
          payload,
        },
      })

      await tx.hashRecord.create({
        data: {
          referenceType: 'PAYMENT_IDEMPOTENCY',
          referenceId: `${userId}:${traceId}`,
          traceId,
          sha256: sha256(`payment_idempotency:${userId}:${traceId}:${JSON.stringify(payload)}`),
          syncStatus: 'PENDING',
        },
      })
    })
  }
}
