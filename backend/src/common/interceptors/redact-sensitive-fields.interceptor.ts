import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { redactSensitiveFields } from '../utils/redact-sensitive-fields';

/**
 * Defense-in-depth safety net against a real class of bug in this codebase:
 * several repositories return raw Prisma rows via `include: { user: true }`
 * (community members, party members, message authors/reactors, friend
 * requests, notification actors, ...) straight through to the HTTP
 * response, with no DTO/serialization boundary in between. A raw Prisma
 * `User` row carries `passwordHash` — so without this, any endpoint that
 * nests another user's record (e.g. `GET /communities/:id/members`) leaks
 * every member's bcrypt hash and email address to any authenticated
 * caller.
 *
 * The individual repository queries should still be tightened to `select`
 * only what's needed (tracked separately — see docs/security/findings.md),
 * but a single global scrubber closes the hole everywhere at once and
 * keeps working if a new call site makes the same mistake later. The same
 * redaction is also applied to Socket.IO broadcasts in realtime.gateway.ts,
 * since those bypass this HTTP interceptor entirely.
 */
@Injectable()
export class RedactSensitiveFieldsInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((payload) => redactSensitiveFields(payload)));
  }
}
