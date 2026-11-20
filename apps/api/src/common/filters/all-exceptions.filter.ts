import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
  issues?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.message : 'Lỗi không xác định');
    }

    response.status(status).json(this.toBody(exception));
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { code: 'ERROR', message: payload };
      }
      const record = payload as Record<string, unknown>;
      return {
        code: typeof record.code === 'string' ? record.code : 'ERROR',
        message: typeof record.message === 'string' ? record.message : 'Yêu cầu thất bại',
        issues: record.issues,
      };
    }
    return { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' };
  }
}
