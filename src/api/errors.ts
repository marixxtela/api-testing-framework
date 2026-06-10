export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'USER_NOT_FOUND'
  | 'ORDER_NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static notFound(code: ErrorCode, message: string): ApiError {
    return new ApiError(404, code, message);
  }

  static badRequest(code: ErrorCode, message: string, details?: unknown): ApiError {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Missing or invalid token'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Action not permitted for this role'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static conflict(code: ErrorCode, message: string): ApiError {
    return new ApiError(409, code, message);
  }
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
