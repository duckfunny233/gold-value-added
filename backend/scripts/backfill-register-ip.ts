/**
 * 为注册审计补全 registerIp（优先沿用首次登录 IP / 最早会话 IP）
 */
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

async function resolveRegisterIp(userId: string) {
  const earliestLoginAudit = await prisma.auditLog.findFirst({
    where: {
      userId,
      module: 'auth',
      action: 'login',
    },
    orderBy: { createdAt: 'asc' },
  })
  const loginIp = String(asRecord(earliestLoginAudit?.payload).ip || '').trim()
  if (loginIp) {
    return loginIp
  }

  const earliestSession = await prisma.userLoginSession.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  const sessionIp = String(earliestSession?.ipLast || '').trim()
  if (sessionIp) {
    return sessionIp
  }

  return ''
}

async function main() {
  const registerLogs = await prisma.auditLog.findMany({
    where: {
      module: 'auth',
      action: 'register',
    },
    select: {
      id: true,
      userId: true,
      payload: true,
    },
  })

  let patched = 0
  for (const log of registerLogs) {
    const payload = asRecord(log.payload)
    if (String(payload.registerIp || '').trim()) {
      continue
    }

    const registerIp = log.userId ? await resolveRegisterIp(log.userId) : ''
    if (!registerIp) {
      continue
    }

    await prisma.auditLog.update({
      where: { id: log.id },
      data: {
        payload: {
          ...payload,
          registerIp,
        } as Prisma.InputJsonValue,
      },
    })
    patched += 1
  }

  console.log(`已补全 ${patched} 条注册审计的 registerIp`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
