import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ message, statusCode, success: false }, statusCode);
  }
}

export class BadRequestException extends AppException {
  constructor(message = 'Bad request') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class NotFoundException extends AppException {
  constructor(entity = 'Resource') {
    super(`${entity} not found`, HttpStatus.NOT_FOUND);
  }
}

export class ConflictException extends AppException {
  constructor(message = 'Resource already exists') {
    super(message, HttpStatus.CONFLICT);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Unauthorized') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends AppException {
  constructor(message = 'Forbidden') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class ValidationException extends AppException {
  constructor(message = 'Validation failed') {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
