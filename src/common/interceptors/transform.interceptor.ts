import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../response/api-response';
import { PaginatedResponse } from '../response/paginated-response';

/**
 * Automatically wraps plain controller returns in ApiResponse.
 * If the controller already returns an ApiResponse or PaginatedResponse,
 * it is passed through untouched.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | PaginatedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | PaginatedResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (
          data instanceof ApiResponse ||
          data instanceof PaginatedResponse
        ) {
          return data;
        }
        // Plain object/array — wrap it
        return ApiResponse.ok(data);
      }),
    );
  }
}
