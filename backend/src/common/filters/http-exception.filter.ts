import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()
    const request = ctx.getRequest()

    const isHttpException = exception instanceof HttpException
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR
    const payload = isHttpException ? exception.getResponse() : null
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? (payload as { message: string }).message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error'

    response.status(status).json({
      code: status,
      message,
      traceId: request.traceId,
      data: null,
    })
  }
}
