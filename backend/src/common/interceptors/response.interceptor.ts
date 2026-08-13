import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse, successResponse } from '../dto/api-response';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((payload) => {
        // Endpoints that already return a paginated shape ({ items, page, ... })
        // are passed through as `data` verbatim so `data.items` stays stable
        // for the frontend rather than being double-wrapped.
        return successResponse(payload);
      }),
    );
  }
}
