import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { map, Observable } from 'rxjs'

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse()
    const statusCode = response.statusCode || 200
    const businessCode = statusCode >= 200 && statusCode < 300 ? 200 : statusCode
    const traceId = response.getHeader('x-trace-id') as string | undefined

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'code' in (data as Record<string, unknown>)) {
          return data
        }

        if (data && typeof data === 'object') {
          const payload = data as Record<string, unknown>
          if ('data' in payload || 'message' in payload) {
            return {
              code: businessCode,
              message: (payload.message as string | undefined) || 'OK',
              traceId,
              data: ('data' in payload ? payload.data : null) ?? null,
            }
          }
        }

        return {
          code: businessCode,
          message: 'OK',
          traceId,
          data,
        }
      }),
    )
  }
}
