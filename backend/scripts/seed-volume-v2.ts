import { createHash, randomUUID } from 'crypto'
import {
  NoticeStatus,
  Prisma,
  PrismaClient,
  RealNameStatus,
  RechargeStatus,
  TradeSide,
  TradeStatus,
  UserStatus,
  WithdrawalStatus,
  AssetChangeType,
  LeaderboardJobStatus,
  LeaderboardRule,
  PaymentScene,
  PaymentStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_COUNT = 100
const GOLD_REFERENCE_PRICE = 560

type CreatedUserSnapshot = {
  uid: string
  nickname: string
  goldHoldingGrams: Prisma.Decimal
  totalAsset: Prisma.Decimal
}

function sha256(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

function toAmount(value: number) {
  return new Prisma.Decimal(value.toFixed(2))
}

function toGrams(value: number) {
  return new Prisma.Decimal(value.toFixed(4))
}

function pickRechargeStatus(index: number) {
  const statuses: RechargeStatus[] = [
    RechargeStatus.COMPLETED,
    RechargeStatus.COMPLETED,
    RechargeStatus.COMPLETED,
    RechargeStatus.PROCESSING,
    RechargeStatus.COMPLETED,
    RechargeStatus.FAILED,
  ]
  return statuses[index % statuses.length]
}

function pickWithdrawalStatus(index: number) {
  const statuses: WithdrawalStatus[] = [
    WithdrawalStatus.PENDING,
    WithdrawalStatus.REVIEWING,
    WithdrawalStatus.APPROVED,
    WithdrawalStatus.COMPLETED,
    WithdrawalStatus.REJECTED,
  ]
  return statuses[index % statuses.length]
}

function pickTradeStatus(index: number) {
  const statuses: TradeStatus[] = [
    TradeStatus.FILLED,
    TradeStatus.FILLED,
    TradeStatus.OPEN,
    TradeStatus.PARTIALLY_FILLED,
    TradeStatus.CANCELLED,
  ]
  return statuses[index % statuses.length]
}

async function ensureLoadAdmin(batchTag: string) {
  const existed = await prisma.adminUser.findFirst({
    where: {
      status: UserStatus.ACTIVE,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  if (existed) {
    return existed
  }

  return prisma.adminUser.create({
    data: {
      username: `load_admin_${batchTag}`,
      passwordHash: 'seeded-password-hash',
      displayName: '联调造数管理员',
      status: UserStatus.ACTIVE,
    },
  })
}

async function ensureMerchant(batchTag: string) {
  const uid = `M${batchTag}`
  const existed = await prisma.user.findUnique({
    where: {
      uid,
    },
    include: {
      asset: true,
    },
  })

  if (existed?.asset) {
    return existed
  }

  const merchant = await prisma.user.create({
    data: {
      uid,
      username: `merchant_${batchTag}`,
      passwordHash: 'seeded-password-hash',
      nickname: '联调商户账户',
      status: UserStatus.ACTIVE,
      realNameStatus: RealNameStatus.VERIFIED,
    },
  })

  await prisma.asset.create({
    data: {
      userId: merchant.id,
      tentativeAsset: toAmount(500000),
      cashAsset: toAmount(500000),
      appreciationIncome: toAmount(50000),
      goldHoldingGrams: toGrams(300),
      withdrawFrozenAmount: toAmount(0),
      totalAsset: toAmount(500000 + 50000 + 300 * GOLD_REFERENCE_PRICE),
    },
  })

  await prisma.paymentProfile.create({
    data: {
      userId: merchant.id,
      qrPayload: `GYC-PAY://collect?uid=${encodeURIComponent(uid)}&name=${encodeURIComponent('联调商户账户')}`,
      displayName: '联调商户账户',
    },
  })

  return prisma.user.findUniqueOrThrow({
    where: { uid },
    include: { asset: true },
  })
}

async function createVolumeData(count: number) {
  const batchTag = `${Date.now()}`.slice(-10)
  const admin = await ensureLoadAdmin(batchTag)
  const merchant = await ensureMerchant(batchTag)
  const createdUsers: CreatedUserSnapshot[] = []

  let rechargeCount = 0
  let withdrawalCount = 0
  let tradeCount = 0
  let paymentCount = 0
  let ledgerCount = 0
  let auditCount = 0
  let hashCount = 0

  for (let i = 0; i < count; i += 1) {
    const seq = String(i + 1).padStart(3, '0')
    const uid = `LT${batchTag}${seq}`
    const username = `loadtest_${batchTag}_${seq}`
    const nickname = `联调用户${seq}`
    const createdAt = new Date(Date.now() - (count - i) * 6 * 60 * 1000)

    await prisma.$transaction(
      async (tx) => {
        const userStatus = i % 17 === 0 ? UserStatus.FROZEN : UserStatus.ACTIVE
        const realNameStatus = i % 9 === 0 ? RealNameStatus.PENDING : RealNameStatus.VERIFIED
        const baseCash = 8000 + (i % 20) * 900 + (i % 3) * 123.45
        const baseAppreciation = 600 + (i % 25) * 81.7
        const baseGold = 6 + (i % 30) * 1.15
        const baseTentative = baseCash + baseAppreciation
        const baseTotal = baseTentative + baseGold * GOLD_REFERENCE_PRICE

        const user = await tx.user.create({
          data: {
            uid,
            username,
            passwordHash: 'seeded-password-hash',
            nickname,
            status: userStatus,
            realNameStatus,
            createdAt,
            updatedAt: createdAt,
          },
        })

        await tx.paymentProfile.create({
          data: {
            userId: user.id,
            qrPayload: `GYC-PAY://collect?uid=${encodeURIComponent(uid)}&name=${encodeURIComponent(nickname)}`,
            displayName: nickname,
            createdAt,
            updatedAt: createdAt,
          },
        })

        const asset = await tx.asset.create({
          data: {
            userId: user.id,
            tentativeAsset: toAmount(baseTentative),
            cashAsset: toAmount(baseCash),
            appreciationIncome: toAmount(baseAppreciation),
            goldHoldingGrams: toGrams(baseGold),
            withdrawFrozenAmount: toAmount(0),
            totalAsset: toAmount(baseTotal),
          },
        })

        let tentative = baseTentative
        let cash = baseCash
        let appreciation = baseAppreciation
        let gold = baseGold
        let total = baseTotal
        let frozen = 0

        const rechargeStatus = pickRechargeStatus(i)
        const rechargeAmount = 500 + ((i * 37) % 3800)
        const rechargeTraceId = randomUUID()
        const rechargeCreatedAt = new Date(createdAt.getTime() + 5 * 60 * 1000)
        const rechargeSettledAt =
          rechargeStatus === RechargeStatus.COMPLETED ? new Date(rechargeCreatedAt.getTime() + 20 * 60 * 1000) : null

        const recharge = await tx.rechargeOrder.create({
          data: {
            userId: user.id,
            channel: i % 3 === 0 ? 'wechat' : i % 3 === 1 ? 'alipay' : 'bank',
            amount: toAmount(rechargeAmount),
            status: rechargeStatus,
            traceId: rechargeTraceId,
            channelReference: `CH${batchTag}${seq}`,
            autoSettleAt: new Date(rechargeCreatedAt.getTime() + 60 * 60 * 1000),
            settledAt: rechargeSettledAt,
            createdAt: rechargeCreatedAt,
            updatedAt: rechargeCreatedAt,
          },
        })
        rechargeCount += 1

        await tx.auditLog.create({
          data: {
            userId: user.id,
            actorType: 'USER',
            actorId: user.id,
            module: 'fund',
            action: 'recharge.create',
            traceId: rechargeTraceId,
            payload: {
              uid,
              amount: rechargeAmount,
              status: rechargeStatus,
            } as Prisma.InputJsonValue,
            createdAt: rechargeCreatedAt,
          },
        })
        auditCount += 1

        await tx.hashRecord.create({
          data: {
            referenceType: 'RECHARGE_ORDER',
            referenceId: recharge.id,
            traceId: rechargeTraceId,
            sha256: sha256(
              rechargeSettledAt
                ? `recharge:${recharge.id}:${rechargeTraceId}:${rechargeAmount}:completed:${rechargeSettledAt.toISOString()}`
                : `recharge:${recharge.id}:${rechargeTraceId}:${rechargeAmount}:processing`,
            ),
            syncStatus: i % 11 === 0 ? 'PENDING' : 'SYNCED',
            syncedAt: i % 11 === 0 ? null : new Date(rechargeCreatedAt.getTime() + 3 * 60 * 1000),
            rechargeOrderId: recharge.id,
            createdAt: rechargeCreatedAt,
          },
        })
        hashCount += 1

        if (rechargeStatus === RechargeStatus.COMPLETED) {
          tentative += rechargeAmount
          cash += rechargeAmount
          total += rechargeAmount
          await tx.asset.update({
            where: { userId: user.id },
            data: {
              tentativeAsset: toAmount(tentative),
              cashAsset: toAmount(cash),
              totalAsset: toAmount(total),
            },
          })

          await tx.ledgerEntry.create({
            data: {
              assetId: asset.id,
              userId: user.id,
              changeType: AssetChangeType.RECHARGE,
              amount: toAmount(rechargeAmount),
              traceId: rechargeTraceId,
              balanceAfter: toAmount(total),
              referenceType: 'RECHARGE_ORDER',
              referenceId: recharge.id,
              createdAt: rechargeCreatedAt,
            },
          })
          ledgerCount += 1
        }

        const withdrawalStatus = pickWithdrawalStatus(i)
        const withdrawalAmount = Math.max(100, Math.min(1800, tentative * 0.18))
        const withdrawalTraceId = randomUUID()
        const withdrawalCreatedAt = new Date(createdAt.getTime() + 12 * 60 * 1000)

        const withdrawal = await tx.withdrawalOrder.create({
          data: {
            userId: user.id,
            amount: toAmount(withdrawalAmount),
            status: withdrawalStatus,
            traceId: withdrawalTraceId,
            submittedAt: withdrawalCreatedAt,
            reviewedAt:
              withdrawalStatus === WithdrawalStatus.REVIEWING ||
              withdrawalStatus === WithdrawalStatus.APPROVED ||
              withdrawalStatus === WithdrawalStatus.COMPLETED ||
              withdrawalStatus === WithdrawalStatus.REJECTED
                ? new Date(withdrawalCreatedAt.getTime() + 20 * 60 * 1000)
                : null,
            completedAt: withdrawalStatus === WithdrawalStatus.COMPLETED ? new Date(withdrawalCreatedAt.getTime() + 90 * 60 * 1000) : null,
            payeeName: nickname,
            bankName: i % 3 === 2 ? '招商银行' : null,
            bankAccountNo: i % 3 === 2 ? `6225****${String(1000 + i).slice(-4)}` : null,
            alipayReceiptUrl: i % 3 === 1 ? `https://seed.local/alipay/${uid}` : null,
            wechatReceiptUrl: i % 3 === 0 ? `https://seed.local/wechat/${uid}` : null,
            reviewerId:
              withdrawalStatus === WithdrawalStatus.REVIEWING ||
              withdrawalStatus === WithdrawalStatus.APPROVED ||
              withdrawalStatus === WithdrawalStatus.COMPLETED ||
              withdrawalStatus === WithdrawalStatus.REJECTED
                ? admin.id
                : null,
            isVoiceMuted: i % 7 === 0,
            createdAt: withdrawalCreatedAt,
            updatedAt: withdrawalCreatedAt,
          },
        })
        withdrawalCount += 1

        await tx.auditLog.create({
          data: {
            userId: user.id,
            actorType: 'USER',
            actorId: user.id,
            module: 'fund',
            action: 'withdraw.create',
            traceId: withdrawalTraceId,
            payload: {
              uid,
              amount: withdrawalAmount,
              status: withdrawalStatus,
              queueNo: withdrawal.queueNo,
            } as Prisma.InputJsonValue,
            createdAt: withdrawalCreatedAt,
          },
        })
        auditCount += 1

        await tx.hashRecord.create({
          data: {
            referenceType: 'WITHDRAWAL_ORDER',
            referenceId: withdrawal.id,
            traceId: withdrawalTraceId,
            sha256: sha256(`withdraw:${withdrawal.id}:${withdrawalTraceId}:${withdrawalAmount}:freeze`),
            syncStatus: i % 9 === 0 ? 'PENDING' : 'SYNCED',
            syncedAt: i % 9 === 0 ? null : new Date(withdrawalCreatedAt.getTime() + 5 * 60 * 1000),
            withdrawalOrderId: withdrawal.id,
            createdAt: withdrawalCreatedAt,
          },
        })
        hashCount += 1

        const applyFreeze = () => {
          tentative -= withdrawalAmount
          total -= withdrawalAmount
          frozen += withdrawalAmount
        }

        const applyRelease = () => {
          tentative += withdrawalAmount
          total += withdrawalAmount
          frozen -= withdrawalAmount
        }

        const applyComplete = () => {
          frozen -= withdrawalAmount
        }

        if (
          withdrawalStatus === WithdrawalStatus.PENDING ||
          withdrawalStatus === WithdrawalStatus.REVIEWING ||
          withdrawalStatus === WithdrawalStatus.APPROVED
        ) {
          applyFreeze()
          await tx.asset.update({
            where: { userId: user.id },
            data: {
              tentativeAsset: toAmount(tentative),
              totalAsset: toAmount(total),
              withdrawFrozenAmount: toAmount(frozen),
            },
          })
          await tx.ledgerEntry.create({
            data: {
              assetId: asset.id,
              userId: user.id,
              changeType: AssetChangeType.WITHDRAW_FREEZE,
              amount: toAmount(withdrawalAmount),
              traceId: withdrawalTraceId,
              balanceAfter: toAmount(total),
              referenceType: 'WITHDRAWAL_ORDER',
              referenceId: withdrawal.id,
              createdAt: withdrawalCreatedAt,
            },
          })
          ledgerCount += 1
        } else if (withdrawalStatus === WithdrawalStatus.COMPLETED) {
          applyFreeze()
          applyComplete()
          await tx.asset.update({
            where: { userId: user.id },
            data: {
              tentativeAsset: toAmount(tentative),
              totalAsset: toAmount(total),
              withdrawFrozenAmount: toAmount(frozen),
            },
          })
          await tx.ledgerEntry.createMany({
            data: [
              {
                assetId: asset.id,
                userId: user.id,
                changeType: AssetChangeType.WITHDRAW_FREEZE,
                amount: toAmount(withdrawalAmount),
                traceId: withdrawalTraceId,
                balanceAfter: toAmount(total),
                referenceType: 'WITHDRAWAL_ORDER',
                referenceId: withdrawal.id,
                createdAt: withdrawalCreatedAt,
              },
              {
                assetId: asset.id,
                userId: user.id,
                changeType: AssetChangeType.WITHDRAW_COMPLETE,
                amount: toAmount(withdrawalAmount),
                traceId: withdrawalTraceId,
                balanceAfter: toAmount(total),
                referenceType: 'WITHDRAWAL_ORDER_COMPLETE',
                referenceId: withdrawal.id,
                createdAt: new Date(withdrawalCreatedAt.getTime() + 80 * 60 * 1000),
              },
            ],
          })
          ledgerCount += 2
        } else if (withdrawalStatus === WithdrawalStatus.REJECTED) {
          applyFreeze()
          applyRelease()
          await tx.asset.update({
            where: { userId: user.id },
            data: {
              tentativeAsset: toAmount(tentative),
              totalAsset: toAmount(total),
              withdrawFrozenAmount: toAmount(frozen),
            },
          })
          await tx.ledgerEntry.createMany({
            data: [
              {
                assetId: asset.id,
                userId: user.id,
                changeType: AssetChangeType.WITHDRAW_FREEZE,
                amount: toAmount(withdrawalAmount),
                traceId: withdrawalTraceId,
                balanceAfter: toAmount(total),
                referenceType: 'WITHDRAWAL_ORDER',
                referenceId: withdrawal.id,
                createdAt: withdrawalCreatedAt,
              },
              {
                assetId: asset.id,
                userId: user.id,
                changeType: AssetChangeType.WITHDRAW_RELEASE,
                amount: toAmount(withdrawalAmount),
                traceId: withdrawalTraceId,
                balanceAfter: toAmount(total),
                referenceType: 'WITHDRAWAL_ORDER_REJECT',
                referenceId: withdrawal.id,
                createdAt: new Date(withdrawalCreatedAt.getTime() + 60 * 60 * 1000),
              },
            ],
          })
          ledgerCount += 2
        }

        const tradeStatus = pickTradeStatus(i)
        const side = i % 2 === 0 ? TradeSide.BUY : TradeSide.SELL
        const price = 540 + (i % 40) * 1.17
        const quantity = 0.5 + (i % 15) * 0.23
        const filledGrams =
          tradeStatus === TradeStatus.FILLED
            ? quantity
            : tradeStatus === TradeStatus.PARTIALLY_FILLED
              ? quantity * 0.35
              : 0
        const tradeTraceId = randomUUID()
        const tradeCreatedAt = new Date(createdAt.getTime() + 18 * 60 * 1000)

        const trade = await tx.tradeOrder.create({
          data: {
            userId: user.id,
            side,
            status: tradeStatus,
            assetCode: 'AU9999',
            price: toAmount(price),
            quantityGrams: toGrams(quantity),
            filledGrams: toGrams(filledGrams),
            traceId: tradeTraceId,
            submittedAt: tradeCreatedAt,
            completedAt: tradeStatus === TradeStatus.FILLED ? new Date(tradeCreatedAt.getTime() + 8 * 60 * 1000) : null,
            createdAt: tradeCreatedAt,
            updatedAt: tradeCreatedAt,
          },
        })
        tradeCount += 1

        await tx.auditLog.create({
          data: {
            userId: user.id,
            actorType: 'USER',
            actorId: user.id,
            module: 'trade',
            action: `trade.submit.${side.toLowerCase()}`,
            traceId: tradeTraceId,
            payload: {
              uid,
              side,
              status: tradeStatus,
              price,
              quantityGrams: quantity,
            } as Prisma.InputJsonValue,
            createdAt: tradeCreatedAt,
          },
        })
        auditCount += 1

        await tx.hashRecord.create({
          data: {
            referenceType: 'TRADE_ORDER',
            referenceId: trade.id,
            traceId: tradeTraceId,
            sha256: sha256(`trade:${trade.id}:${tradeTraceId}:${side}:${price}:${quantity}`),
            syncStatus: i % 8 === 0 ? 'PENDING' : 'SYNCED',
            syncedAt: i % 8 === 0 ? null : new Date(tradeCreatedAt.getTime() + 4 * 60 * 1000),
            tradeOrderId: trade.id,
            createdAt: tradeCreatedAt,
          },
        })
        hashCount += 1

        if (tradeStatus === TradeStatus.FILLED) {
          const tradeValue = price * quantity
          if (side === TradeSide.BUY && tentative >= tradeValue && cash >= tradeValue) {
            tentative -= tradeValue
            cash -= tradeValue
            gold += quantity
            await tx.asset.update({
              where: { userId: user.id },
              data: {
                tentativeAsset: toAmount(tentative),
                cashAsset: toAmount(cash),
                goldHoldingGrams: toGrams(gold),
                totalAsset: toAmount(total),
              },
            })
            await tx.ledgerEntry.create({
              data: {
                assetId: asset.id,
                userId: user.id,
                changeType: AssetChangeType.TRADE_BUY,
                amount: toAmount(tradeValue),
                traceId: tradeTraceId,
                balanceAfter: toAmount(total),
                referenceType: 'TRADE_MATCH',
                referenceId: trade.id,
                createdAt: new Date(tradeCreatedAt.getTime() + 8 * 60 * 1000),
              },
            })
            ledgerCount += 1
          }

          if (side === TradeSide.SELL && gold >= quantity) {
            const tradeValue = price * quantity
            tentative += tradeValue
            cash += tradeValue
            gold -= quantity
            await tx.asset.update({
              where: { userId: user.id },
              data: {
                tentativeAsset: toAmount(tentative),
                cashAsset: toAmount(cash),
                goldHoldingGrams: toGrams(gold),
                totalAsset: toAmount(total),
              },
            })
            await tx.ledgerEntry.create({
              data: {
                assetId: asset.id,
                userId: user.id,
                changeType: AssetChangeType.TRADE_SELL,
                amount: toAmount(tradeValue),
                traceId: tradeTraceId,
                balanceAfter: toAmount(total),
                referenceType: 'TRADE_MATCH',
                referenceId: trade.id,
                createdAt: new Date(tradeCreatedAt.getTime() + 8 * 60 * 1000),
              },
            })
            ledgerCount += 1
          }
        }

        if (i % 2 === 0) {
          const paymentAmount = Math.min(180 + (i % 7) * 35, Math.max(60, appreciation * 0.22))
          if (appreciation > paymentAmount + 50 && total > paymentAmount + 100) {
            const paymentTraceId = randomUUID()
            const paymentCreatedAt = new Date(createdAt.getTime() + 30 * 60 * 1000)

            appreciation -= paymentAmount
            total -= paymentAmount
            await tx.asset.update({
              where: { userId: user.id },
              data: {
                appreciationIncome: toAmount(appreciation),
                totalAsset: toAmount(total),
              },
            })

            await tx.asset.update({
              where: { userId: merchant.id },
              data: {
                appreciationIncome: {
                  increment: toAmount(paymentAmount),
                },
                totalAsset: {
                  increment: toAmount(paymentAmount),
                },
              },
            })

            const payment = await tx.paymentOrder.create({
              data: {
                traceId: paymentTraceId,
                payerId: user.id,
                payeeId: merchant.id,
                amount: toAmount(paymentAmount),
                scene: i % 4 === 0 ? PaymentScene.MERCHANT : PaymentScene.USER,
                status: PaymentStatus.COMPLETED,
                remark: i % 4 === 0 ? '商户扫码支付' : '用户互转',
                idempotencyKey: `${batchTag}-pay-${seq}`,
                completedAt: paymentCreatedAt,
                createdAt: paymentCreatedAt,
                updatedAt: paymentCreatedAt,
              },
            })
            paymentCount += 1

            await tx.ledgerEntry.createMany({
              data: [
                {
                  assetId: asset.id,
                  userId: user.id,
                  changeType: AssetChangeType.PAYMENT_OUT,
                  amount: toAmount(-paymentAmount),
                  traceId: paymentTraceId,
                  balanceAfter: toAmount(total),
                  referenceType: 'PAYMENT_ORDER',
                  referenceId: payment.id,
                  createdAt: paymentCreatedAt,
                },
                {
                  assetId: merchant.asset!.id,
                  userId: merchant.id,
                  changeType: AssetChangeType.PAYMENT_IN,
                  amount: toAmount(paymentAmount),
                  traceId: paymentTraceId,
                  balanceAfter: merchant.asset!.totalAsset,
                  referenceType: 'PAYMENT_ORDER',
                  referenceId: payment.id,
                  createdAt: paymentCreatedAt,
                },
              ],
            })
            ledgerCount += 2

            await tx.auditLog.createMany({
              data: [
                {
                  userId: user.id,
                  actorType: 'USER',
                  actorId: user.id,
                  module: 'payment',
                  action: 'payment.transfer.out',
                  traceId: paymentTraceId,
                  payload: {
                    payerUid: uid,
                    payeeUid: merchant.uid,
                    amount: paymentAmount,
                  } as Prisma.InputJsonValue,
                  createdAt: paymentCreatedAt,
                },
                {
                  userId: merchant.id,
                  actorType: 'USER',
                  actorId: user.id,
                  module: 'payment',
                  action: 'payment.transfer.in',
                  traceId: paymentTraceId,
                  payload: {
                    payerUid: uid,
                    payeeUid: merchant.uid,
                    amount: paymentAmount,
                  } as Prisma.InputJsonValue,
                  createdAt: paymentCreatedAt,
                },
              ],
            })
            auditCount += 2

            await tx.hashRecord.create({
              data: {
                referenceType: 'PAYMENT_ORDER',
                referenceId: payment.id,
                traceId: paymentTraceId,
                sha256: sha256(`payment:${payment.id}:${paymentTraceId}:${uid}:${merchant.uid}:${paymentAmount}`),
                syncStatus: i % 6 === 0 ? 'PENDING' : 'SYNCED',
                syncedAt: i % 6 === 0 ? null : new Date(paymentCreatedAt.getTime() + 2 * 60 * 1000),
                paymentOrderId: payment.id,
                createdAt: paymentCreatedAt,
              },
            })
            hashCount += 1
          }
        }

        const finalAsset = await tx.asset.findUniqueOrThrow({
          where: {
            userId: user.id,
          },
        })

        createdUsers.push({
          uid,
          nickname,
          goldHoldingGrams: finalAsset.goldHoldingGrams,
          totalAsset: finalAsset.totalAsset,
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  }

  const leaderboardTraceId = randomUUID()
  const version = `lb-seed-${batchTag}`
  const snapshots = [...createdUsers]
    .sort((left, right) => {
      const goldGap = Number(right.goldHoldingGrams) - Number(left.goldHoldingGrams)
      if (goldGap !== 0) {
        return goldGap
      }
      return left.uid.localeCompare(right.uid)
    })
    .map((item, index) => ({
      rank: index + 1,
      uid: item.uid,
      nickname: item.nickname,
      goldHoldingGrams: item.goldHoldingGrams,
      totalAsset: item.totalAsset,
      syncStatus: index % 21 === 0 ? 'exception' : 'synced',
      updatedAt: new Date(),
    }))

  const failedRows = snapshots.filter((item) => item.syncStatus === 'exception').length
  const leaderboardJob = await prisma.leaderboardJob.create({
    data: {
      version,
      rule: LeaderboardRule.GOLD_HOLDING_GRAMS,
      status: failedRows > 0 ? LeaderboardJobStatus.FAILED : LeaderboardJobStatus.SYNCED,
      traceId: leaderboardTraceId,
      totalRows: snapshots.length,
      failedRows,
      errorMessage: failedRows > 0 ? `${failedRows} 条排行榜记录需修复` : null,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  })

  await prisma.leaderboardSnapshot.createMany({
    data: snapshots.map((item) => ({
      jobId: leaderboardJob.id,
      rank: item.rank,
      uid: item.uid,
      nickname: item.nickname,
      goldHoldingGrams: item.goldHoldingGrams,
      totalAsset: item.totalAsset,
      syncStatus: item.syncStatus,
      updatedAt: item.updatedAt,
    })),
  })

  await prisma.leaderboardConfig.upsert({
    where: {
      scope: 'default',
    },
    create: {
      scope: 'default',
      currentRule: LeaderboardRule.GOLD_HOLDING_GRAMS,
      traceId: leaderboardTraceId,
    },
    update: {
      currentRule: LeaderboardRule.GOLD_HOLDING_GRAMS,
      traceId: leaderboardTraceId,
    },
  })

  const notices = Array.from({ length: 12 }).map((_, index) => ({
    title: `联调公告 ${batchTag}-${String(index + 1).padStart(2, '0')}`,
    content: `这是一条用于后台页面联调的公告内容，编号 ${index + 1}。`,
    status: index % 4 === 0 ? NoticeStatus.DRAFT : NoticeStatus.PUBLISHED,
    sortOrder: index,
    publishedAt: index % 4 === 0 ? null : new Date(Date.now() - index * 60 * 60 * 1000),
  }))

  await prisma.notice.createMany({ data: notices })

  return {
    batchTag,
    users: count,
    rechargeCount,
    withdrawalCount,
    tradeCount,
    paymentCount,
    ledgerCount,
    auditCount,
    hashCount,
    leaderboardSnapshots: snapshots.length,
    notices: notices.length,
  }
}

async function main() {
  const raw = process.argv[2]
  const count = raw ? Number(raw) : DEFAULT_COUNT
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('请输入合法的造数条数，例如: npm run seed:volume -- 100')
  }

  const result = await createVolumeData(count)
  console.log('造数完成:')
  console.table(result)
}

main()
  .catch((error) => {
    console.error('造数失败:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
