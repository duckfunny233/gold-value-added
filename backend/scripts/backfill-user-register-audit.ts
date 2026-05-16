/**
 * 为「已实名」但注册审计缺少 idNumber 的用户补全证件号与注册审计（联调造数历史数据修复）
 */
import { createHash, randomUUID } from 'crypto'
import { Prisma, PrismaClient, RealNameStatus } from '@prisma/client'

const prisma = new PrismaClient()

function sha256(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

async function main() {
  const users = await prisma.user.findMany({
    where: { realNameStatus: RealNameStatus.VERIFIED },
    orderBy: { createdAt: 'asc' },
  })

  let patched = 0
  for (const user of users) {
    const registerLog = await prisma.auditLog.findFirst({
      where: {
        userId: user.id,
        module: 'auth',
        action: 'register',
      },
      orderBy: { createdAt: 'asc' },
    })

    const payload = asRecord(registerLog?.payload)
    if (String(payload.idNumber || '').trim()) {
      continue
    }

    const seq = user.uid.match(/(\d+)$/)?.[1] || String(patched + 1)
    const demoIdNumber = `11010119900301${seq.padStart(4, '0').slice(-4)}`
    const demoPhone = user.phone || `138${String(10000000 + Number(seq)).padStart(8, '0')}`

    if (registerLog) {
      await prisma.auditLog.update({
        where: { id: registerLog.id },
        data: {
          payload: {
            ...payload,
            uid: user.uid,
            username: user.username,
            phone: demoPhone,
            realName: payload.realName || user.nickname || user.username,
            idNumber: demoIdNumber,
            idNumberHash: sha256(demoIdNumber),
            registerChannel: payload.registerChannel || 'seed-backfill',
          } as Prisma.InputJsonValue,
        },
      })
    } else {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          actorType: 'USER',
          actorId: user.id,
          module: 'auth',
          action: 'register',
          traceId: randomUUID(),
          payload: {
            uid: user.uid,
            username: user.username,
            phone: demoPhone,
            realName: user.nickname || user.username,
            idNumber: demoIdNumber,
            idNumberHash: sha256(demoIdNumber),
            registerChannel: 'seed-backfill',
          } as Prisma.InputJsonValue,
          createdAt: user.createdAt,
        },
      })
    }

    if (!user.phone) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: demoPhone },
      })
    }

    patched += 1
  }

  console.log(`已补全 ${patched} 名已实名用户的证件号审计记录`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
