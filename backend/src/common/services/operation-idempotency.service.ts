import { ConflictException, Injectable } from '@nestjs/common'
import { OperationIdempotencyStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { sha256 } from '../utils/hash.util'
import { stableStringify } from '../utils/idempotency.util'

type ReserveResult =
  | {
      mode: 'execute'
      id: string
      key: string
      requestHash: string
      traceId: string
    }
  | {
      mode: 'replay'
      id: string
      key: string
      requestHash: string
      traceId: string
      responsePayload: Record<string, unknown>
    }
  | {
      mode: 'conflict'
      id: string
      key: string
      requestHash: string
      traceId: string
    }

@Injectable()
export class OperationIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  createRequestHash(payload: unknown) {
    return sha256(stableStringify(payload))
  }

  buildScopedKey(scope: string, key: string) {
    return `${scope}:${key}`
  }

  async reserve(scope: string, key: string, requestPayload: unknown, traceId: string): Promise<ReserveResult> {
    const requestHash = this.createRequestHash(requestPayload)
    const scopedKey = this.buildScopedKey(scope, key)

    try {
      const record = await this.prisma.operationIdempotency.create({
        data: {
          key: scopedKey,
          scope,
          requestHash,
          status: OperationIdempotencyStatus.PENDING,
          traceId,
        },
      })

      return {
        mode: 'execute',
        id: record.id,
        key: scopedKey,
        requestHash,
        traceId: record.traceId,
      }
    } catch (error) {
      const record = await this.prisma.operationIdempotency.findUnique({
        where: {
          key: scopedKey,
        },
      })

      if (!record) {
        throw error
      }

      if (record.requestHash !== requestHash) {
        throw new ConflictException('幂等键已被其它请求占用')
      }

      if (
        record.status === OperationIdempotencyStatus.SUCCEEDED &&
        record.responsePayload &&
        typeof record.responsePayload === 'object' &&
        !Array.isArray(record.responsePayload)
      ) {
        return {
          mode: 'replay',
          id: record.id,
          key: scopedKey,
          requestHash,
          traceId: record.traceId,
          responsePayload: record.responsePayload as Record<string, unknown>,
        }
      }

      if (record.status === OperationIdempotencyStatus.FAILED) {
        const takeover = await this.prisma.operationIdempotency.updateMany({
          where: {
            id: record.id,
            status: OperationIdempotencyStatus.FAILED,
          },
          data: {
            status: OperationIdempotencyStatus.PENDING,
            responsePayload: undefined,
            traceId,
          },
        })

        if (takeover.count === 1) {
          return {
            mode: 'execute',
            id: record.id,
            key: scopedKey,
            requestHash,
            traceId,
          }
        }
      }

      return {
        mode: 'conflict',
        id: record.id,
        key: scopedKey,
        requestHash,
        traceId: record.traceId,
      }
    }
  }

  async markSucceeded(id: string, traceId: string, responsePayload: Record<string, unknown>) {
    await this.prisma.operationIdempotency.update({
      where: {
        id,
      },
      data: {
        status: OperationIdempotencyStatus.SUCCEEDED,
        traceId,
        responsePayload: responsePayload as Prisma.InputJsonValue,
      },
    })
  }

  async markFailed(id: string, traceId: string, errorPayload: Record<string, unknown>) {
    await this.prisma.operationIdempotency.update({
      where: {
        id,
      },
      data: {
        status: OperationIdempotencyStatus.FAILED,
        traceId,
        responsePayload: errorPayload as Prisma.InputJsonValue,
      },
    })
  }
}
