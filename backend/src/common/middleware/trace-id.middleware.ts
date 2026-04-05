import { Injectable, NestMiddleware } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { NextFunction, Request, Response } from 'express'

type RequestWithTrace = Request & {
  traceId?: string
}

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: RequestWithTrace, res: Response, next: NextFunction) {
    const incomingTraceId = req.header('x-trace-id')
    const traceId = incomingTraceId || randomUUID()

    req.traceId = traceId
    res.setHeader('x-trace-id', traceId)
    next()
  }
}
