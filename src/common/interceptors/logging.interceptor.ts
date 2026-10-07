import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, body, user } = req;
    const userId = user?.id ?? 'anonymous';
    const now = Date.now();

    this.logger.log(`→ [${method}] ${url} | user: ${userId}`);

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        this.logger.log(
          `← [${method}] ${url} ${res.statusCode} | ${Date.now() - now}ms`,
        );
      }),
    );
  }
}
