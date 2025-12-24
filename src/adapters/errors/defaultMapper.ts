/**
 * Default error mapper for adorn-api
 * 
 * Maps common error types to appropriate HTTP responses.
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Error mapper function type
 */
export type ErrorMapper = (error: Error, req: Request, res: Response, next: NextFunction) => void;

/**
 * Default error mapper configuration
 */
export interface ErrorMapperConfig {
  /** Map of error constructors to status codes */
  statusMap?: Map<new (...args: any[]) => Error, number>;
  /** Default status code for unknown errors */
  defaultStatus?: number;
  /** Whether to log errors to console */
  logErrors?: boolean;
  /** Custom error message formatter */
  formatMessage?: (error: Error) => string;
}

/**
 * Create a default error mapper with custom configuration
 */
export function createErrorMapper(config: ErrorMapperConfig = {}): ErrorMapper {
  const {
    statusMap = createDefaultStatusMap(),
    defaultStatus = 500,
    logErrors = true,
    formatMessage = (error) => error.message,
  } = config;

  return function errorMapper(error: Error, req: Request, res: Response, _next: NextFunction) {
    // Log the error if enabled
    if (logErrors) {
      console.error('Error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
      });
    }

    // Determine status code
    let statusCode = defaultStatus;
    
    // Check for known error types
    for (const [ErrorType, code] of statusMap) {
      if (error instanceof ErrorType) {
        statusCode = code;
        break;
      }
    }
    
    // Check for custom status property (common in error libraries)
    if ('status' in error && typeof (error as any).status === 'number') {
      statusCode = (error as any).status;
    }
    
    // Check for statusCode property
    if ('statusCode' in error && typeof (error as any).statusCode === 'number') {
      statusCode = (error as any).statusCode;
    }

    // Send error response
    const responseBody: ErrorResponse = {
      error: getErrorType(error),
      message: formatMessage(error),
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.url,
    };

    // Include stack trace in development
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      responseBody.stack = error.stack;
    }

    res.status(statusCode).json(responseBody);
  };
}

/**
 * Create the default mapping of error types to HTTP status codes
 */
function createDefaultStatusMap(): Map<new (...args: any[]) => Error, number> {
  const map = new Map<new (...args: any[]) => Error, number>();
  
  // Common HTTP errors (400-499)
  map.set(BadRequestError, 400);
  map.set(UnauthorizedError, 401);
  map.set(ForbiddenError, 403);
  map.set(NotFoundError, 404);
  map.set(ConflictError, 409);
  map.set(UnprocessableEntityError, 422);
  map.set(TooManyRequestsError, 429);
  
  // Server errors (500-599)
  map.set(InternalServerError, 500);
  map.set(NotImplementedError, 501);
  map.set(ServiceUnavailableError, 503);
  
  return map;
}

/**
 * Get a simplified error type name
 */
function getErrorType(error: Error): string {
  // Remove 'Error' suffix if present
  let type = error.constructor.name;
  if (type.endsWith('Error')) {
    type = type.slice(0, -5);
  }
  return type;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  stack?: string;
}

// Common error classes

export class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string = 'Bad Request') {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class UnprocessableEntityError extends Error {
  statusCode = 422;
  constructor(message: string = 'Unprocessable Entity') {
    super(message);
    this.name = 'UnprocessableEntityError';
  }
}

export class TooManyRequestsError extends Error {
  statusCode = 429;
  constructor(message: string = 'Too Many Requests') {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}

export class InternalServerError extends Error {
  statusCode = 500;
  constructor(message: string = 'Internal Server Error') {
    super(message);
    this.name = 'InternalServerError';
  }
}

export class NotImplementedError extends Error {
  statusCode = 501;
  constructor(message: string = 'Not Implemented') {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export class ServiceUnavailableError extends Error {
  statusCode = 503;
  constructor(message: string = 'Service Unavailable') {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Base HttpError interface (for compatibility)
 */
export interface HttpError extends Error {
  statusCode?: number;
}
