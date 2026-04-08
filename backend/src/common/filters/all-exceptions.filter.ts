import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';

/**
 * Evita vazar stack trace e detalhes internos em produção para erros não tratados.
 * Exceções HttpException (validação, 404, etc.) seguem o formato padrão do Nest.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(body);
      return;
    }

    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`${request.method} ${request.url} — ${err.message}`, err.stack);

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status).json(
      isProd
        ? {
            statusCode: status,
            message: 'Erro interno do servidor',
          }
        : {
            statusCode: status,
            message: err.message,
            error: err.name,
          },
    );
  }
}
