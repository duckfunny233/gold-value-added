import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  AssetChangeType,
  AuditLog,
  Asset,
  Prisma,
  PrismaClient,
  RechargeOrder,
  RechargeStatus,
  User,
  WithdrawalOrder,
  WithdrawalStatus,
} from '@prisma/client'
import { randomUUID } from 'crypto'
import { OperationIdempotencyService } from '../../common/services/operation-idempotency.service'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import {
  AdminFundQueryDto,
  FundQueryDto,
  ManualFundActionDto,
  RechargeDto,
  WithdrawDto,
} from './fund.dto'
import { AdminActor, LedgerRow, RechargeRow, WithdrawRow } from './fund.types'

type FundTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>

type UserWithAsset = User & {
  asset: {
    id: string
    tentativeAsset: Prisma.Decimal
    cashAsset: Prisma.Decimal
    totalAsset: Prisma.Decimal
    withdrawFrozenAmount: Prisma.Decimal
  } | null
}

const WITHDRAW_STATUS = {
  PENDING_REVIEW: 'pending_review',
  TRANSFER_PROCESSING: 'transfer_processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
} as const

const WITHDRAW_ALERT_STATUS = {
  RINGING: 'ringing',
  MUTED: 'muted',
  STOPPED: 'stopped',
} as const

const CHANNEL_LABELS = {
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行卡',
} as const

const WITHDRAW_PROCESSING_DB_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.REVIEWING,
  WithdrawalStatus.APPROVED,
]

const WITHDRAW_REJECTABLE_DB_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.PENDING,
  WithdrawalStatus.REVIEWING,
  WithdrawalStatus.APPROVED,
]

const WITHDRAW_TERMINAL_DB_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.COMPLETED,
  WithdrawalStatus.REJECTED,
]

const RECHARGE_RECONCILING_STATUSES: RechargeStatus[] = [
  RechargeStatus.PENDING,
  RechargeStatus.PROCESSING,
]

const RECHARGE_FILTER_STATUSES = new Set<string>(['reconciling', 'reconciled'])
const WITHDRAW_FILTER_STATUSES = new Set<string>([
  WITHDRAW_STATUS.PENDING_REVIEW,
  WITHDRAW_STATUS.TRANSFER_PROCESSING,
  WITHDRAW_STATUS.COMPLETED,
  WITHDRAW_STATUS.REJECTED,
])

@Injectable()
export class FundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationIdempotencyService: OperationIdempotencyService,
  ) {}

  async createRecharge(body: RechargeDto) {
    const user = await this.requireUser(body.username)
    if (!user.asset) {
      throw new NotFoundException('用户资产不存在')
    }

    const traceId = randomUUID()
    const amount = new Prisma.Decimal(body.amount)
    const settledAt = new Date()
    const autoSettleAt = new Date(settledAt)

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedAsset = await tx.asset.update({
        where: {
          userId: user.id,
        },
        data: {
          tentativeAsset: {
            increment: amount,
          },
          cashAsset: {
            increment: amount,
          },
          totalAsset: {
            increment: amount,
          },
        },
      })

      const rechargeOrder = await tx.rechargeOrder.create({
        data: {
          userId: user.id,
          channel: body.channel,
          amount,
          status: RechargeStatus.COMPLETED,
          traceId,
          autoSettleAt,
          settledAt,
        },
      })

      await this.createLedgerEntry(tx, {
        assetId: updatedAsset.id,
        userId: user.id,
        changeType: AssetChangeType.RECHARGE,
        amount,
        traceId,
        balanceAfter: updatedAsset.totalAsset,
        referenceType: 'RECHARGE_ORDER',
        referenceId: rechargeOrder.id,
      })

      await this.createHashRecord(tx, {
        referenceType: 'RECHARGE_ORDER',
        referenceId: rechargeOrder.id,
        traceId,
        raw: `recharge:${rechargeOrder.id}:${traceId}:${body.amount}:completed:${settledAt.toISOString()}`,
        rechargeOrderId: rechargeOrder.id,
      })

      await this.createAuditLog(tx, {
        userId: user.id,
        actorType: 'USER',
        actorId: user.id,
        module: 'fund',
        action: 'recharge.create',
        traceId,
        payload: {
          channel: body.channel,
          amount: body.amount,
          username: user.username,
          settledAt: settledAt.toISOString(),
        } as Prisma.InputJsonValue,
      })

      return {
        rechargeOrder,
        updatedAsset,
      }
    })

    return {
      message: '充值已自动到账',
      data: {
        orderId: result.rechargeOrder.id,
        traceId,
        channel: body.channel,
        amount: body.amount,
        status: result.rechargeOrder.status,
        autoSettleAt: autoSettleAt.toISOString(),
        settledAt: settledAt.toISOString(),
        assetEffect: {
          tentativeAssetDelta: body.amount,
          cashAssetDelta: body.amount,
          totalAssetDelta: body.amount,
        },
        latestBalance: {
          tentativeAsset: Number(result.updatedAsset.tentativeAsset),
          cashAsset: Number(result.updatedAsset.cashAsset),
          totalAsset: Number(result.updatedAsset.totalAsset),
          withdrawFrozenAmount: Number(result.updatedAsset.withdrawFrozenAmount),
        },
      },
    }
  }

  async createWithdrawal(body: WithdrawDto) {
    const user = await this.requireUser(body.username)
    if (!user.asset) {
      throw new NotFoundException('用户资产不存在')
    }

    const amount = new Prisma.Decimal(body.amount)
    const traceId = randomUUID()

    const order = await this.prisma.$transaction(async (tx) => {
      const updatedAssetCount = await tx.asset.updateMany({
        where: {
          userId: user.id,
          tentativeAsset: {
            gte: amount,
          },
          totalAsset: {
            gte: amount,
          },
        },
        data: {
          tentativeAsset: {
            decrement: amount,
          },
          totalAsset: {
            decrement: amount,
          },
          withdrawFrozenAmount: {
            increment: amount,
          },
        },
      })

      if (updatedAssetCount.count !== 1) {
        throw new ConflictException('暂定资产不足或请求冲突，请刷新后重试')
      }

      const updatedAsset = await tx.asset.findUnique({
        where: {
          userId: user.id,
        },
      })
      if (!updatedAsset) {
        throw new NotFoundException('用户资产不存在')
      }

      const withdrawalOrder = await tx.withdrawalOrder.create({
        data: {
          userId: user.id,
          amount,
          status: WithdrawalStatus.PENDING,
          traceId,
          payeeName: body.payeeName,
          wechatReceiptUrl: body.wechatReceiptUrl,
          alipayReceiptUrl: body.alipayReceiptUrl,
          bankName: body.bankName,
          bankAccountNo: body.bankAccountNo,
          bankAccountHolder: body.bankAccountHolder,
        },
      })

      await this.createLedgerEntry(tx, {
        assetId: updatedAsset.id,
        userId: user.id,
        changeType: AssetChangeType.WITHDRAW_FREEZE,
        amount,
        traceId,
        balanceAfter: updatedAsset.totalAsset,
        referenceType: 'WITHDRAWAL_ORDER',
        referenceId: withdrawalOrder.id,
      })

      await this.createHashRecord(tx, {
        referenceType: 'WITHDRAWAL_ORDER',
        referenceId: withdrawalOrder.id,
        traceId,
        raw: `withdraw:${withdrawalOrder.id}:${traceId}:${body.amount}:freeze`,
        withdrawalOrderId: withdrawalOrder.id,
      })

      await this.createAuditLog(tx, {
        userId: user.id,
        actorType: 'USER',
        actorId: user.id,
        module: 'fund',
        action: 'withdraw.create',
        traceId,
        payload: {
          amount: body.amount,
          queueNo: withdrawalOrder.queueNo,
          username: user.username,
        } as Prisma.InputJsonValue,
      })

      return {
        withdrawalOrder,
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    return {
      message: '提现申请已提交',
      data: {
        orderId: order.withdrawalOrder.id,
        traceId,
        amount: body.amount,
        status: this.mapWithdrawStatus(order.withdrawalOrder.status),
        queueNo: order.withdrawalOrder.queueNo,
        assetEffect: {
          tentativeAssetDelta: -body.amount,
          totalAssetDelta: -body.amount,
          withdrawFrozenAmountDelta: body.amount,
        },
      },
    }
  }

  async manualTransfer(body: ManualFundActionDto, actor: AdminActor, idempotencyKey?: string) {
    return this.applyManualBalanceAction(body, actor, {
      action: 'fund.manual-transfer',
      referenceType: 'MANUAL_TRANSFER',
      message: '手工转账已生效',
    }, idempotencyKey)
  }

  async manualAdjust(body: ManualFundActionDto, actor: AdminActor, idempotencyKey?: string) {
    return this.applyManualBalanceAction(body, actor, {
      action: 'fund.manual-adjust',
      referenceType: 'MANUAL_ADJUST',
      message: '手工补款已生效',
    }, idempotencyKey)
  }

  async getRechargeOrders(query: FundQueryDto) {
    const userId = await this.resolveUserId(query)
    const orders = await this.prisma.rechargeOrder.findMany({
      where: userId ? { userId } : undefined,
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return orders.map((order) => ({
      orderId: order.id,
      uid: order.user.uid,
      username: order.user.username,
      channel: order.channel,
      amount: Number(order.amount),
      status: order.status,
      traceId: order.traceId,
      createdAt: order.createdAt,
      autoSettleAt: order.autoSettleAt,
      settledAt: order.settledAt,
    }))
  }

  async getWithdrawalOrders(query: FundQueryDto) {
    const userId = await this.resolveUserId(query)
    const orders = await this.prisma.withdrawalOrder.findMany({
      where: userId ? { userId } : undefined,
      include: {
        user: true,
      },
      orderBy: [{ queueNo: 'asc' }, { submittedAt: 'asc' }],
    })

    return orders.map((order) => ({
      orderId: order.id,
      uid: order.user.uid,
      username: order.user.username,
      amount: Number(order.amount),
      status: order.status,
      queueNo: order.queueNo,
      submittedAt: order.submittedAt,
      isVoiceMuted: order.isVoiceMuted,
      payeeName: order.payeeName,
      wechatReceiptUrl: order.wechatReceiptUrl,
      alipayReceiptUrl: order.alipayReceiptUrl,
      bankName: order.bankName,
      bankAccountNo: order.bankAccountNo,
      bankAccountHolder: order.bankAccountHolder,
    }))
  }

  async getAdminFunds(query: AdminFundQueryDto) {
    const [rechargeOrders, withdrawalOrders, ledgerRows] = await Promise.all([
      this.findRechargeOrders(query),
      this.findWithdrawalOrders(query),
      this.findLedgerRows(query),
    ])

    const rechargeRows = rechargeOrders.map((order) => this.toRechargeRow(order))
    const withdrawRows = withdrawalOrders
      .map((order) => this.toWithdrawRow(order))
      .sort((left, right) => {
        if (left.queueNo !== right.queueNo) {
          return left.queueNo - right.queueNo
        }
        return left.submittedAtIso.localeCompare(right.submittedAtIso)
      })

    return {
      summaryCards: this.buildSummaryCards(rechargeOrders, withdrawalOrders),
      rechargeRows: query.orderType === 'withdraw' ? [] : rechargeRows,
      withdrawRows: query.orderType === 'recharge' ? [] : withdrawRows,
      ledgerRows,
      reconcileItems: this.buildReconcileItems(rechargeOrders),
    }
  }

  async approveWithdrawal(orderId: string, actor: AdminActor) {
    const action = 'withdraw.approve'
    const reserved = await this.operationIdempotencyService.reserve(
      'fund.withdraw.approve',
      orderId,
      { orderId, actorId: actor.adminUserId, action },
      randomUUID(),
    )

    if (reserved.mode === 'replay') {
      await this.recordAdminOperationReplay(actor, action, reserved.traceId, orderId, reserved.responsePayload)
      return reserved.responsePayload
    }
    if (reserved.mode === 'conflict') {
      await this.recordAdminOperationConflict(actor, action, reserved.traceId, orderId)
      throw new ConflictException('提现审核处理中，请勿重复提交')
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const context = await this.requireWithdrawalContext(tx, orderId)
        const approved = await tx.withdrawalOrder.updateMany({
          where: {
            id: orderId,
            status: WithdrawalStatus.PENDING,
          },
          data: {
            status: WithdrawalStatus.REVIEWING,
            reviewedAt: new Date(),
          },
        })

        if (approved.count !== 1) {
          throw new ConflictException('当前提现单已被其他操作处理')
        }

        const updatedOrder = await tx.withdrawalOrder.findUnique({
          where: {
            id: orderId,
          },
        })
        if (!updatedOrder) {
          throw new NotFoundException('提现订单不存在')
        }

        await this.createHashRecord(tx, {
          referenceType: 'WITHDRAWAL_ORDER_APPROVE',
          referenceId: updatedOrder.id,
          traceId: reserved.traceId,
          raw: `withdraw:${updatedOrder.id}:${reserved.traceId}:approve`,
          withdrawalOrderId: updatedOrder.id,
        })

        await this.createAuditLog(tx, {
          userId: context.order.userId,
          actorType: 'ADMIN',
          actorId: actor.adminUserId,
          module: 'fund',
          action,
          traceId: reserved.traceId,
          payload: {
            orderId: updatedOrder.id,
            username: actor.username,
          } as Prisma.InputJsonValue,
        })

        await this.createAdminOperationLog(tx, {
          adminUserId: actor.adminUserId,
          action,
          traceId: reserved.traceId,
          payload: {
            orderId: updatedOrder.id,
            username: actor.username,
            result: '成功',
          } as Prisma.InputJsonValue,
        })

        return updatedOrder
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })

      const response = {
        orderId: result.id,
        traceId: reserved.traceId,
        status: this.mapWithdrawStatus(result.status),
        alertStatus: this.mapWithdrawAlertStatus(result.status, result.isVoiceMuted),
      }
      await this.operationIdempotencyService.markSucceeded(reserved.id, reserved.traceId, response)
      return response
    } catch (error) {
      await this.operationIdempotencyService.markFailed(reserved.id, reserved.traceId, {
        orderId,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async rejectWithdrawal(orderId: string, actor: AdminActor) {
    const action = 'withdraw.reject'
    const reserved = await this.operationIdempotencyService.reserve(
      'fund.withdraw.reject',
      orderId,
      { orderId, actorId: actor.adminUserId, action },
      randomUUID(),
    )

    if (reserved.mode === 'replay') {
      await this.recordAdminOperationReplay(actor, action, reserved.traceId, orderId, reserved.responsePayload)
      return reserved.responsePayload
    }
    if (reserved.mode === 'conflict') {
      await this.recordAdminOperationConflict(actor, action, reserved.traceId, orderId)
      throw new ConflictException('提现驳回处理中，请勿重复提交')
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const context = await this.requireWithdrawalContext(tx, orderId)
        if (!WITHDRAW_REJECTABLE_DB_STATUSES.includes(context.order.status)) {
          throw new BadRequestException('当前提现单不允许拒绝')
        }

        const rejected = await tx.withdrawalOrder.updateMany({
          where: {
            id: orderId,
            status: {
              in: WITHDRAW_REJECTABLE_DB_STATUSES,
            },
          },
          data: {
            status: WithdrawalStatus.REJECTED,
            isVoiceMuted: true,
          },
        })

        if (rejected.count !== 1) {
          throw new ConflictException('当前提现单已被其他操作处理')
        }

        const updatedAssetCount = await tx.asset.updateMany({
          where: {
            userId: context.order.userId,
            withdrawFrozenAmount: {
              gte: context.order.amount,
            },
          },
          data: {
            tentativeAsset: {
              increment: context.order.amount,
            },
            totalAsset: {
              increment: context.order.amount,
            },
            withdrawFrozenAmount: {
              decrement: context.order.amount,
            },
          },
        })

        if (updatedAssetCount.count !== 1) {
          throw new ConflictException('冻结金额不足，无法驳回提现')
        }

        const [updatedAsset, updatedOrder] = await Promise.all([
          tx.asset.findUnique({
            where: {
              userId: context.order.userId,
            },
          }),
          tx.withdrawalOrder.findUnique({
            where: {
              id: orderId,
            },
          }),
        ])

        if (!updatedAsset || !updatedOrder) {
          throw new NotFoundException('提现订单或资产不存在')
        }

        await this.createLedgerEntry(tx, {
          assetId: updatedAsset.id,
          userId: context.order.userId,
          changeType: AssetChangeType.WITHDRAW_RELEASE,
          amount: context.order.amount,
          traceId: reserved.traceId,
          balanceAfter: updatedAsset.totalAsset,
          referenceType: 'WITHDRAWAL_ORDER_REJECT',
          referenceId: updatedOrder.id,
        })

        await this.createHashRecord(tx, {
          referenceType: 'WITHDRAWAL_ORDER_REJECT',
          referenceId: updatedOrder.id,
          traceId: reserved.traceId,
          raw: `withdraw:${updatedOrder.id}:${reserved.traceId}:reject`,
          withdrawalOrderId: updatedOrder.id,
        })

        await this.createAuditLog(tx, {
          userId: context.order.userId,
          actorType: 'ADMIN',
          actorId: actor.adminUserId,
          module: 'fund',
          action,
          traceId: reserved.traceId,
          payload: {
            orderId: updatedOrder.id,
            username: actor.username,
          } as Prisma.InputJsonValue,
        })

        await this.createAdminOperationLog(tx, {
          adminUserId: actor.adminUserId,
          action,
          traceId: reserved.traceId,
          payload: {
            orderId: updatedOrder.id,
            username: actor.username,
            result: '成功',
          } as Prisma.InputJsonValue,
        })

        return {
          order: updatedOrder,
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })

      const response = {
        orderId: result.order.id,
        traceId: reserved.traceId,
        status: this.mapWithdrawStatus(result.order.status),
        alertStatus: this.mapWithdrawAlertStatus(result.order.status, result.order.isVoiceMuted),
        assetEffect: {
          tentativeAssetDelta: Number(result.order.amount),
          totalAssetDelta: Number(result.order.amount),
          withdrawFrozenAmountDelta: -Number(result.order.amount),
        },
      }
      await this.operationIdempotencyService.markSucceeded(reserved.id, reserved.traceId, response)
      return response
    } catch (error) {
      await this.operationIdempotencyService.markFailed(reserved.id, reserved.traceId, {
        orderId,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async confirmWithdrawalCompleted(orderId: string, actor: AdminActor) {
    const action = 'withdraw.confirm-completed'
    const reserved = await this.operationIdempotencyService.reserve(
      'fund.withdraw.confirm-completed',
      orderId,
      { orderId, actorId: actor.adminUserId, action },
      randomUUID(),
    )

    if (reserved.mode === 'replay') {
      await this.recordAdminOperationReplay(actor, action, reserved.traceId, orderId, reserved.responsePayload)
      return reserved.responsePayload
    }
    if (reserved.mode === 'conflict') {
      await this.recordAdminOperationConflict(actor, action, reserved.traceId, orderId)
      throw new ConflictException('提现完成确认处理中，请勿重复提交')
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const context = await this.requireWithdrawalContext(tx, orderId)
        if (!WITHDRAW_PROCESSING_DB_STATUSES.includes(context.order.status)) {
          throw new BadRequestException('当前提现单不处于转账处理中')
        }

        const completed = await tx.withdrawalOrder.updateMany({
          where: {
            id: orderId,
            status: {
              in: WITHDRAW_PROCESSING_DB_STATUSES,
            },
          },
          data: {
            status: WithdrawalStatus.COMPLETED,
            completedAt: new Date(),
            isVoiceMuted: true,
          },
        })

        if (completed.count !== 1) {
          throw new ConflictException('当前提现单已被其他操作处理')
        }

        const updatedAssetCount = await tx.asset.updateMany({
          where: {
            userId: context.order.userId,
            withdrawFrozenAmount: {
              gte: context.order.amount,
            },
          },
          data: {
            withdrawFrozenAmount: {
              decrement: context.order.amount,
            },
          },
        })

        if (updatedAssetCount.count !== 1) {
          throw new ConflictException('冻结金额不足，无法确认完成')
        }

        const [updatedAsset, updatedOrder] = await Promise.all([
          tx.asset.findUnique({
            where: {
              userId: context.order.userId,
            },
          }),
          tx.withdrawalOrder.findUnique({
            where: {
              id: orderId,
            },
          }),
        ])

        if (!updatedAsset || !updatedOrder) {
          throw new NotFoundException('提现订单或资产不存在')
        }

        await this.createLedgerEntry(tx, {
          assetId: updatedAsset.id,
          userId: context.order.userId,
          changeType: AssetChangeType.WITHDRAW_COMPLETE,
          amount: context.order.amount,
          traceId: reserved.traceId,
          balanceAfter: updatedAsset.totalAsset,
          referenceType: 'WITHDRAWAL_ORDER_COMPLETE',
          referenceId: updatedOrder.id,
        })

        await this.createHashRecord(tx, {
          referenceType: 'WITHDRAWAL_ORDER_COMPLETE',
          referenceId: updatedOrder.id,
          traceId: reserved.traceId,
          raw: `withdraw:${updatedOrder.id}:${reserved.traceId}:complete`,
          withdrawalOrderId: updatedOrder.id,
        })

        await this.createAuditLog(tx, {
          userId: context.order.userId,
          actorType: 'ADMIN',
          actorId: actor.adminUserId,
          module: 'fund',
          action,
          traceId: reserved.traceId,
          payload: {
            orderId: updatedOrder.id,
            username: actor.username,
          } as Prisma.InputJsonValue,
        })

        await this.createAdminOperationLog(tx, {
          adminUserId: actor.adminUserId,
          action,
          traceId: reserved.traceId,
          payload: {
            orderId: updatedOrder.id,
            username: actor.username,
            result: '成功',
          } as Prisma.InputJsonValue,
        })

        return {
          order: updatedOrder,
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })

      const response = {
        orderId: result.order.id,
        traceId: reserved.traceId,
        status: this.mapWithdrawStatus(result.order.status),
        alertStatus: this.mapWithdrawAlertStatus(result.order.status, result.order.isVoiceMuted),
        assetEffect: {
          tentativeAssetDelta: 0,
          totalAssetDelta: 0,
          withdrawFrozenAmountDelta: -Number(result.order.amount),
        },
      }
      await this.operationIdempotencyService.markSucceeded(reserved.id, reserved.traceId, response)
      return response
    } catch (error) {
      await this.operationIdempotencyService.markFailed(reserved.id, reserved.traceId, {
        orderId,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async muteWithdrawalAlert(orderId: string, actor: AdminActor) {
    const result = await this.prisma.$transaction(async (tx) => {
      const context = await this.requireWithdrawalContext(tx, orderId)
      if (WITHDRAW_TERMINAL_DB_STATUSES.includes(context.order.status)) {
        throw new BadRequestException('已完成或已拒绝的提现单无需静音')
      }

      const updatedOrder = await tx.withdrawalOrder.update({
        where: {
          id: orderId,
        },
        data: {
          isVoiceMuted: true,
        },
      })

      await this.createHashRecord(tx, {
        referenceType: 'WITHDRAWAL_ORDER_MUTE',
        referenceId: updatedOrder.id,
        traceId: updatedOrder.traceId,
        raw: `withdraw:${updatedOrder.id}:${updatedOrder.traceId}:mute`,
        withdrawalOrderId: updatedOrder.id,
      })

      await this.createAuditLog(tx, {
        userId: context.order.userId,
        actorType: 'ADMIN',
        actorId: actor.adminUserId,
        module: 'fund',
        action: 'withdraw.mute-alert',
        traceId: updatedOrder.traceId,
        payload: {
          orderId: updatedOrder.id,
          username: actor.username,
        } as Prisma.InputJsonValue,
      })

      return updatedOrder
    })

    return {
      orderId: result.id,
      status: this.mapWithdrawStatus(result.status),
      alertStatus: this.mapWithdrawAlertStatus(result.status, result.isVoiceMuted),
    }
  }

  private async applyManualBalanceAction(
    body: ManualFundActionDto,
    actor: AdminActor,
    options: {
      action: string
      referenceType: string
      message: string
    },
    idempotencyKey?: string,
  ) {
    const user = await this.requireUserByUid(body.uid)
    if (!user.asset) {
      throw new NotFoundException('用户资产不存在')
    }

    const amount = new Prisma.Decimal(body.amount)
    const signedAmount =
      body.direction === 'increase' ? amount : new Prisma.Decimal(0).minus(amount)
    const resolvedIdempotencyKey =
      idempotencyKey ||
      body.clientRequestId ||
      this.operationIdempotencyService.createRequestHash({
        uid: body.uid,
        amount: body.amount,
        direction: body.direction,
        reason: body.reason,
        actorId: actor.adminUserId,
        action: options.action,
      })

    const reserved = await this.operationIdempotencyService.reserve(
      options.action,
      resolvedIdempotencyKey,
      {
        uid: body.uid,
        amount: body.amount,
        direction: body.direction,
        reason: body.reason,
        actorId: actor.adminUserId,
      },
      randomUUID(),
    )

    if (reserved.mode === 'replay') {
      await this.recordAdminOperationReplay(actor, `${options.action}.idempotency-hit`, reserved.traceId, body.uid, reserved.responsePayload)
      return reserved.responsePayload
    }
    if (reserved.mode === 'conflict') {
      await this.recordAdminOperationConflict(actor, `${options.action}.conflict`, reserved.traceId, body.uid)
      throw new ConflictException('资金调整处理中，请勿重复提交')
    }

    try {
      const updatedAsset = await this.prisma.$transaction(async (tx) => {
        const updatedAssetCount = await tx.asset.updateMany({
          where:
            body.direction === 'increase'
              ? {
                  userId: user.id,
                }
              : {
                  userId: user.id,
                  tentativeAsset: {
                    gte: amount,
                  },
                  totalAsset: {
                    gte: amount,
                  },
                },
          data:
            body.direction === 'increase'
              ? {
                  tentativeAsset: {
                    increment: amount,
                  },
                  totalAsset: {
                    increment: amount,
                  },
                }
              : {
                  tentativeAsset: {
                    decrement: amount,
                  },
                  totalAsset: {
                    decrement: amount,
                  },
                },
        })

        if (updatedAssetCount.count !== 1) {
          throw new ConflictException('用户资产不足或请求冲突，请刷新后重试')
        }

        const asset = await tx.asset.findUnique({
          where: {
            userId: user.id,
          },
        })
        if (!asset) {
          throw new NotFoundException('用户资产不存在')
        }

        await this.createLedgerEntry(tx, {
          assetId: asset.id,
          userId: user.id,
          changeType: AssetChangeType.MANUAL_ADJUST,
          amount: signedAmount,
          traceId: reserved.traceId,
          balanceAfter: asset.totalAsset,
          referenceType: options.referenceType,
          referenceId: user.id,
        })

        await this.createHashRecord(tx, {
          referenceType: options.referenceType,
          referenceId: user.id,
          traceId: reserved.traceId,
          raw: `${options.referenceType}:${user.id}:${body.uid}:${body.direction}:${body.amount}:${body.reason}:${reserved.traceId}`,
        })

        await this.createAuditLog(tx, {
          userId: user.id,
          actorType: 'ADMIN',
          actorId: actor.adminUserId,
          module: 'fund',
          action: options.action,
          traceId: reserved.traceId,
          payload: {
            uid: body.uid,
            amount: body.amount,
            direction: body.direction,
            reason: body.reason,
            username: actor.username,
          } as Prisma.InputJsonValue,
        })

        await this.createAdminOperationLog(tx, {
          adminUserId: actor.adminUserId,
          action: options.action,
          traceId: reserved.traceId,
          payload: {
            uid: body.uid,
            amount: body.amount,
            direction: body.direction,
            reason: body.reason,
            username: actor.username,
            result: '成功',
          } as Prisma.InputJsonValue,
        })

        return asset
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })

      const response = {
        message: options.message,
        data: {
          uid: body.uid,
          traceId: reserved.traceId,
          amount: body.amount,
          direction: body.direction,
          reason: body.reason,
          latestBalance: this.toAssetBalance(updatedAsset),
        },
      }
      await this.operationIdempotencyService.markSucceeded(reserved.id, reserved.traceId, response)
      return response
    } catch (error) {
      await this.operationIdempotencyService.markFailed(reserved.id, reserved.traceId, {
        uid: body.uid,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  private async findRechargeOrders(query: AdminFundQueryDto) {
    if (query.status && !RECHARGE_FILTER_STATUSES.has(query.status)) {
      return []
    }

    const userId = await this.resolveUserId({ uid: query.uid })
    const where: Prisma.RechargeOrderWhereInput = {
      ...(userId ? { userId } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.timeRange ? { createdAt: this.resolveTimeRange(query.timeRange) } : {}),
      ...(query.status ? this.mapRechargeStatusFilter(query.status) : {}),
    }

    return this.prisma.rechargeOrder.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  private async findWithdrawalOrders(query: AdminFundQueryDto) {
    if (query.status && !WITHDRAW_FILTER_STATUSES.has(query.status)) {
      return []
    }

    const userId = await this.resolveUserId({ uid: query.uid })
    const where: Prisma.WithdrawalOrderWhereInput = {
      ...(userId ? { userId } : {}),
      ...(query.timeRange ? { submittedAt: this.resolveTimeRange(query.timeRange) } : {}),
      ...(query.channel ? this.buildWithdrawalChannelFilter(query.channel) : {}),
      ...(query.status ? this.mapWithdrawalStatusFilter(query.status) : {}),
    }

    return this.prisma.withdrawalOrder.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: [{ queueNo: 'asc' }, { submittedAt: 'asc' }],
    })
  }

  private async findLedgerRows(query: AdminFundQueryDto): Promise<LedgerRow[]> {
    const userId = await this.resolveUserId({ uid: query.uid })
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(query.timeRange ? { createdAt: this.resolveTimeRange(query.timeRange) } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    })

    const [assets, auditLogs] = await Promise.all([
      entries.length
        ? this.prisma.asset.findMany({
            where: {
              id: {
                in: Array.from(new Set(entries.map((item) => item.assetId))),
              },
            },
            include: {
              user: true,
            },
          })
        : [],
      entries.length
        ? this.prisma.auditLog.findMany({
            where: {
              traceId: {
                in: entries.map((item) => item.traceId),
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : [],
    ])

    const userByAssetId = new Map(assets.map((item) => [item.id, item.user]))
    const auditByTraceId = new Map<string, AuditLog>()
    for (const log of auditLogs) {
      if (!auditByTraceId.has(log.traceId)) {
        auditByTraceId.set(log.traceId, log)
      }
    }

    return entries.map((entry) => ({
      traceId: entry.traceId,
      type: this.mapLedgerType(entry.changeType),
      target: userByAssetId.get(entry.assetId)?.uid || entry.userId,
      amount: this.formatLedgerAmount(entry.changeType, Number(entry.amount)),
      operator: this.resolveOperator(auditByTraceId.get(entry.traceId)),
      updatedAt: this.formatDateTime(entry.createdAt),
    }))
  }

  private buildSummaryCards(rechargeOrders: RechargeOrder[], withdrawalOrders: WithdrawalOrder[]) {
    const completedRecharges = rechargeOrders.filter((item) => item.status === RechargeStatus.COMPLETED)
    const pendingWithdrawals = withdrawalOrders.filter((item) => item.status === WithdrawalStatus.PENDING)
    const processingWithdrawals = withdrawalOrders.filter((item) =>
      WITHDRAW_PROCESSING_DB_STATUSES.includes(item.status),
    )
    const reconcileExceptions = rechargeOrders.filter((item) => item.status === RechargeStatus.FAILED)

    return [
      {
        label: '自动到账充值',
        value: `${completedRecharges.length}笔`,
        note: '24 小时内自动入账',
      },
      {
        label: '待审核提现',
        value: `${pendingWithdrawals.length}笔`,
        note: '按提交时间顺序排队',
      },
      {
        label: '线下打款处理中',
        value: `${processingWithdrawals.length}笔`,
        note: '待确认到账',
      },
      {
        label: '资金对账异常',
        value: `${reconcileExceptions.length}笔`,
        note: '需要人工复核渠道流水',
      },
    ]
  }

  private buildReconcileItems(rechargeOrders: RechargeOrder[]) {
    return (['wechat', 'alipay', 'bank'] as const).map((channelKey) => {
      const rows = rechargeOrders.filter((item) => item.channel === channelKey)
      const completed = rows.filter((item) => item.status === RechargeStatus.COMPLETED).length
      const processing = rows.filter((item) =>
        RECHARGE_RECONCILING_STATUSES.includes(item.status),
      ).length
      const failed = rows.filter((item) => item.status === RechargeStatus.FAILED).length

      if (rows.length === 0) {
        return `${CHANNEL_LABELS[channelKey]}：暂无数据`
      }
      if (failed > 0) {
        return `${CHANNEL_LABELS[channelKey]}：待人工复核 ${failed} 笔`
      }
      if (processing > 0) {
        return `${CHANNEL_LABELS[channelKey]}：对账中 ${processing} 笔`
      }
      return `${CHANNEL_LABELS[channelKey]}：已完成 ${completed}/${rows.length} 笔`
    })
  }

  private toRechargeRow(order: RechargeOrder & { user: User }): RechargeRow {
    return {
      orderId: order.id,
      uid: order.user.uid,
      nickname: order.user.nickname || order.user.username,
      channel: CHANNEL_LABELS[order.channel as keyof typeof CHANNEL_LABELS] || order.channel,
      amount: this.formatCurrency(Number(order.amount)),
      status: this.mapRechargeStatusLabel(order.status),
      createdAt: this.formatDateTime(order.createdAt),
      traceId: order.traceId,
    }
  }

  private toWithdrawRow(order: WithdrawalOrder & { user: User }): WithdrawRow {
    return {
      orderId: order.id,
      uid: order.user.uid,
      nickname: order.user.nickname || order.user.username,
      channel: this.getWithdrawalChannelLabel(order),
      amount: this.formatCurrency(Number(order.amount)),
      status: this.mapWithdrawStatus(order.status),
      alertStatus: this.mapWithdrawAlertStatus(order.status, order.isVoiceMuted),
      createdAt: this.formatDateTime(order.submittedAt),
      payout: this.buildPayout(order),
      queueNo: order.queueNo,
      submittedAtIso: order.submittedAt.toISOString(),
    }
  }

  private getWithdrawalChannelLabel(
    order: Pick<WithdrawalOrder, 'bankName' | 'bankAccountNo' | 'alipayReceiptUrl' | 'wechatReceiptUrl'>,
  ) {
    if (order.bankName || order.bankAccountNo) {
      return CHANNEL_LABELS.bank
    }
    if (order.alipayReceiptUrl) {
      return CHANNEL_LABELS.alipay
    }
    if (order.wechatReceiptUrl) {
      return CHANNEL_LABELS.wechat
    }
    return CHANNEL_LABELS.bank
  }

  private buildPayout(
    order: Pick<
      WithdrawalOrder,
      'payeeName' | 'bankName' | 'bankAccountNo' | 'bankAccountHolder' | 'alipayReceiptUrl' | 'wechatReceiptUrl'
    >,
  ) {
    if (order.bankName || order.bankAccountNo) {
      const holder = order.bankAccountHolder || order.payeeName || ''
      return `${order.bankName || '银行卡'} ${this.maskBankAccount(order.bankAccountNo)}${holder ? ` / ${holder}` : ''}`.trim()
    }
    if (order.alipayReceiptUrl) {
      return '支付宝收款码已上传'
    }
    if (order.wechatReceiptUrl) {
      return '微信收款码已上传'
    }
    return order.payeeName || '待补充收款信息'
  }

  private mapRechargeStatusLabel(status: RechargeStatus) {
    if (status === RechargeStatus.COMPLETED) {
      return '已对账'
    }
    if (status === RechargeStatus.FAILED) {
      return '异常'
    }
    return '对账中'
  }

  private mapRechargeStatusFilter(status: AdminFundQueryDto['status']) {
    if (status === 'reconciling') {
      return {
        status: {
          in: [RechargeStatus.PENDING, RechargeStatus.PROCESSING],
        },
      }
    }
    if (status === 'reconciled') {
      return {
        status: RechargeStatus.COMPLETED,
      }
    }
    if (status === 'rejected') {
      return {
        status: RechargeStatus.FAILED,
      }
    }
    return {}
  }

  private mapWithdrawStatus(status: WithdrawalStatus) {
    if (status === WithdrawalStatus.COMPLETED) {
      return WITHDRAW_STATUS.COMPLETED
    }
    if (status === WithdrawalStatus.REJECTED) {
      return WITHDRAW_STATUS.REJECTED
    }
    if (WITHDRAW_PROCESSING_DB_STATUSES.includes(status)) {
      return WITHDRAW_STATUS.TRANSFER_PROCESSING
    }
    return WITHDRAW_STATUS.PENDING_REVIEW
  }

  private mapWithdrawalStatusFilter(status: AdminFundQueryDto['status']) {
    switch (status) {
      case WITHDRAW_STATUS.PENDING_REVIEW:
        return { status: WithdrawalStatus.PENDING }
      case WITHDRAW_STATUS.TRANSFER_PROCESSING:
        return { status: { in: [WithdrawalStatus.REVIEWING, WithdrawalStatus.APPROVED] } }
      case WITHDRAW_STATUS.COMPLETED:
        return { status: WithdrawalStatus.COMPLETED }
      case WITHDRAW_STATUS.REJECTED:
        return { status: WithdrawalStatus.REJECTED }
      default:
        return {}
    }
  }

  private mapWithdrawAlertStatus(status: WithdrawalStatus, isVoiceMuted: boolean) {
    if (WITHDRAW_TERMINAL_DB_STATUSES.includes(status)) {
      return WITHDRAW_ALERT_STATUS.STOPPED
    }
    return isVoiceMuted ? WITHDRAW_ALERT_STATUS.MUTED : WITHDRAW_ALERT_STATUS.RINGING
  }

  private buildWithdrawalChannelFilter(channel: NonNullable<AdminFundQueryDto['channel']>) {
    if (channel === 'wechat') {
      return { wechatReceiptUrl: { not: null } }
    }
    if (channel === 'alipay') {
      return { alipayReceiptUrl: { not: null } }
    }
    return {
      OR: [{ bankName: { not: null } }, { bankAccountNo: { not: null } }],
    }
  }

  private resolveTimeRange(timeRange: NonNullable<AdminFundQueryDto['timeRange']>) {
    const now = new Date()
    const start = new Date(now)
    if (timeRange === '30d') {
      start.setDate(now.getDate() - 30)
    } else if (timeRange === '7d') {
      start.setDate(now.getDate() - 7)
    }
    start.setHours(0, 0, 0, 0)
    return {
      gte: start,
    }
  }

  private async requireUser(username: string): Promise<UserWithAsset> {
    const user = await this.prisma.user.findUnique({
      where: {
        username,
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

  private async resolveUserId(query: Pick<FundQueryDto, 'username' | 'uid'>) {
    if (!query.username && !query.uid) {
      return null
    }
    const user = await this.prisma.user.findFirst({
      where: query.uid ? { uid: query.uid } : { username: query.username },
    })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    return user.id
  }

  private async requireWithdrawalContext(tx: FundTx, orderId: string) {
    const order = await tx.withdrawalOrder.findUnique({
      where: {
        id: orderId,
      },
    })
    if (!order) {
      throw new NotFoundException('提现订单不存在')
    }

    const asset = await tx.asset.findUnique({
      where: {
        userId: order.userId,
      },
    })
    if (!asset) {
      throw new NotFoundException('用户资产不存在')
    }

    if (
      WITHDRAW_PROCESSING_DB_STATUSES.includes(order.status) ||
      WITHDRAW_REJECTABLE_DB_STATUSES.includes(order.status)
    ) {
      if (asset.withdrawFrozenAmount.lt(order.amount)) {
        throw new BadRequestException('冻结金额不足，无法处理提现订单')
      }
    }

    return {
      order,
      asset,
    }
  }

  private async createHashRecord(
    tx: FundTx,
    payload: {
      referenceType: string
      referenceId: string
      traceId: string
      raw: string
      rechargeOrderId?: string
      withdrawalOrderId?: string
      tradeOrderId?: string
    },
  ) {
    await tx.hashRecord.create({
      data: {
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        traceId: payload.traceId,
        sha256: sha256(payload.raw),
        syncStatus: 'PENDING',
        rechargeOrderId: payload.rechargeOrderId,
        withdrawalOrderId: payload.withdrawalOrderId,
        tradeOrderId: payload.tradeOrderId,
      },
    })
  }

  private async createAuditLog(
    tx: FundTx,
    payload: {
      userId: string | null
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

  private async createAdminOperationLog(
    tx: FundTx,
    payload: {
      adminUserId: string
      action: string
      traceId: string
      payload: Prisma.InputJsonValue
    },
  ) {
    await tx.adminOperationLog.create({
      data: {
        adminUserId: payload.adminUserId,
        module: 'fund',
        action: payload.action,
        traceId: payload.traceId,
        payload: payload.payload,
      },
    })
  }

  private async createLedgerEntry(
    tx: FundTx,
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

  private async recordAdminOperationReplay(
    actor: AdminActor,
    action: string,
    traceId: string,
    referenceId: string,
    responsePayload: Record<string, unknown>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.adminOperationLog.create({
        data: {
          adminUserId: actor.adminUserId,
          module: 'fund',
          action,
          traceId,
          payload: {
            referenceId,
            result: '幂等命中',
          },
        },
      })
      await tx.auditLog.create({
        data: {
          userId: null,
          actorType: 'ADMIN',
          actorId: actor.adminUserId,
          module: 'fund',
          action,
          traceId,
          payload: {
            referenceId,
            responsePayload: responsePayload as Prisma.InputJsonValue,
            result: '幂等命中',
          } as Prisma.InputJsonValue,
        },
      })
      await tx.hashRecord.create({
        data: {
          referenceType: 'FUND_IDEMPOTENCY_HIT',
          referenceId,
          traceId,
          sha256: sha256(`fund_idempotency_hit:${referenceId}:${traceId}:${JSON.stringify(responsePayload)}`),
          syncStatus: 'PENDING',
        },
      })
    })
  }

  private async recordAdminOperationConflict(
    actor: AdminActor,
    action: string,
    traceId: string,
    referenceId: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.adminOperationLog.create({
        data: {
          adminUserId: actor.adminUserId,
          module: 'fund',
          action,
          traceId,
          payload: {
            referenceId,
            result: '并发冲突',
          },
        },
      })
      await tx.auditLog.create({
        data: {
          userId: null,
          actorType: 'ADMIN',
          actorId: actor.adminUserId,
          module: 'fund',
          action,
          traceId,
          payload: {
            referenceId,
            result: '并发冲突',
          },
        },
      })
      await tx.hashRecord.create({
        data: {
          referenceType: 'FUND_CONFLICT',
          referenceId,
          traceId,
          sha256: sha256(`fund_conflict:${referenceId}:${traceId}`),
          syncStatus: 'PENDING',
        },
      })
    })
  }

  private mapLedgerType(changeType: AssetChangeType) {
    const labels: Record<AssetChangeType, string> = {
      [AssetChangeType.RECHARGE]: '充值到账',
      [AssetChangeType.WITHDRAW_FREEZE]: '提现冻结',
      [AssetChangeType.WITHDRAW_RELEASE]: '提现驳回回补',
      [AssetChangeType.WITHDRAW_COMPLETE]: '提现完成',
      [AssetChangeType.TRADE_BUY]: '交易买入',
      [AssetChangeType.TRADE_SELL]: '交易卖出',
      [AssetChangeType.MANUAL_ADJUST]: '资产调整',
      [AssetChangeType.PAYMENT_OUT]: '增值收益支付',
      [AssetChangeType.PAYMENT_IN]: '增值收益收款',
    }
    return labels[changeType]
  }

  private resolveOperator(audit?: AuditLog) {
    if (!audit) {
      return '系统'
    }
    if (audit.payload && typeof audit.payload === 'object' && !Array.isArray(audit.payload)) {
      const payload = audit.payload as Record<string, unknown>
      if (typeof payload.username === 'string' && payload.username) {
        return payload.username
      }
    }
    return audit.actorType === 'ADMIN' ? '管理员' : '系统'
  }

  private formatCurrency(amount: number) {
    return `¥${amount.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  private formatLedgerAmount(changeType: AssetChangeType, amount: number) {
    const abs = this.formatCurrency(amount).slice(1)
    if (changeType === AssetChangeType.WITHDRAW_FREEZE) {
      return `-${abs}`
    }
    if (
      changeType === AssetChangeType.WITHDRAW_RELEASE ||
      changeType === AssetChangeType.RECHARGE ||
      changeType === AssetChangeType.PAYMENT_IN
    ) {
      return `+${abs}`
    }
    if (changeType === AssetChangeType.PAYMENT_OUT) {
      return `-${abs}`
    }
    if (changeType === AssetChangeType.MANUAL_ADJUST) {
      const normalized = this.formatCurrency(Math.abs(amount)).slice(1)
      return `${amount >= 0 ? '+' : '-'}${normalized}`
    }
    return this.formatCurrency(amount)
  }

  private formatDateTime(value: Date) {
    const pad = (input: number) => String(input).padStart(2, '0')
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }

  private maskBankAccount(accountNo?: string | null) {
    if (!accountNo) {
      return ''
    }
    return `**** ${accountNo.slice(-4)}`
  }

  private toAssetBalance(asset: Pick<Asset, 'tentativeAsset' | 'cashAsset' | 'totalAsset' | 'withdrawFrozenAmount'>) {
    return {
      tentativeAsset: Number(asset.tentativeAsset),
      cashAsset: Number(asset.cashAsset),
      totalAsset: Number(asset.totalAsset),
      withdrawFrozenAmount: Number(asset.withdrawFrozenAmount),
    }
  }
}
