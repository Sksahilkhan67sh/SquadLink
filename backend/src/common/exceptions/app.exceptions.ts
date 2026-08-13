import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}

export class ResourceNotFoundException extends AppException {
  constructor(resource: string, identifier?: string) {
    super(
      'RESOURCE_NOT_FOUND',
      identifier
        ? `${resource} '${identifier}' was not found`
        : `${resource} was not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ConflictException extends AppException {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, HttpStatus.CONFLICT, details);
  }
}

export class ForbiddenActionException extends AppException {
  constructor(message = 'You are not allowed to perform this action') {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}

export class InvalidCredentialsException extends AppException {
  constructor(message = 'Invalid email or password') {
    super('INVALID_CREDENTIALS', message, HttpStatus.UNAUTHORIZED);
  }
}

export class TokenExpiredException extends AppException {
  constructor(message = 'This token has expired') {
    super('TOKEN_EXPIRED', message, HttpStatus.UNAUTHORIZED);
  }
}

export class EmailNotVerifiedException extends AppException {
  constructor(message = 'Please verify your email before continuing') {
    super('EMAIL_NOT_VERIFIED', message, HttpStatus.FORBIDDEN);
  }
}
