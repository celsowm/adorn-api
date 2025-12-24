import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  createErrorMapper,
  ErrorResponse,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  NotImplementedError,
  ServiceUnavailableError,
} from '../../src/adapters/errors/defaultMapper.js';

describe('Error Mapper', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonSpy: any;
  let statusSpy: any;

  beforeEach(() => {
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnThis();
    mockReq = {
      url: '/test',
      method: 'GET',
    };
    mockRes = {
      status: statusSpy,
      json: jsonSpy,
    };
    mockNext = vi.fn();
    
    // Suppress console.error during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createErrorMapper', () => {
    it('should create a function', () => {
      const mapper = createErrorMapper();
      expect(typeof mapper).toBe('function');
    });

    it('should map BadRequestError to 400', () => {
      const mapper = createErrorMapper();
      const error = new BadRequestError('Invalid input');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalled();
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('BadRequest');
      expect(response.message).toBe('Invalid input');
      expect(response.statusCode).toBe(400);
    });

    it('should map UnauthorizedError to 401', () => {
      const mapper = createErrorMapper();
      const error = new UnauthorizedError('Please log in');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(401);
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('Unauthorized');
    });

    it('should map ForbiddenError to 403', () => {
      const mapper = createErrorMapper();
      const error = new ForbiddenError('Access denied');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(403);
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('Forbidden');
    });

    it('should map NotFoundError to 404', () => {
      const mapper = createErrorMapper();
      const error = new NotFoundError('Resource not found');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(404);
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('NotFound');
    });

    it('should map ConflictError to 409', () => {
      const mapper = createErrorMapper();
      const error = new ConflictError('Duplicate entry');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(409);
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('Conflict');
    });

    it('should map UnprocessableEntityError to 422', () => {
      const mapper = createErrorMapper();
      const error = new UnprocessableEntityError('Invalid data');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(422);
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('UnprocessableEntity');
    });

    it('should map TooManyRequestsError to 429', () => {
      const mapper = createErrorMapper();
      const error = new TooManyRequestsError('Rate limit exceeded');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(429);
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('TooManyRequests');
    });

    it('should map InternalServerError to 500', () => {
      const mapper = createErrorMapper();
      const error = new InternalServerError('Something went wrong');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('InternalServer');
    });

    it('should map NotImplementedError to 501', () => {
      const mapper = createErrorMapper();
      const error = new NotImplementedError('Not implemented');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(501);
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('NotImplemented');
    });

    it('should map ServiceUnavailableError to 503', () => {
      const mapper = createErrorMapper();
      const error = new ServiceUnavailableError('Service down');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(503);
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.error).toBe('ServiceUnavailable');
    });

    it('should include timestamp in response', () => {
      const mapper = createErrorMapper();
      const error = new BadRequestError('Test');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.timestamp).toBeDefined();
      // Verify it's an ISO date string
      expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
    });

    it('should include path in response', () => {
      const mapper = createErrorMapper();
      const error = new BadRequestError('Test');
      mockReq.url = '/api/users';
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.path).toBe('/api/users');
    });

    it('should default to 500 for unknown errors', () => {
      const mapper = createErrorMapper();
      const error = new Error('Unknown error');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
    });

    it('should respect custom statusCode property', () => {
      const mapper = createErrorMapper();
      const error = new Error('Custom error');
      (error as any).statusCode = 418;
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(418);
    });

    it('should respect custom status property', () => {
      const mapper = createErrorMapper();
      const error = new Error('Custom error');
      (error as any).status = 419;
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(419);
    });

    it('should include stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const mapper = createErrorMapper();
      const error = new Error('Test with stack');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.stack).toBeDefined();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const mapper = createErrorMapper();
      const error = new Error('Test no stack');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.stack).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should use custom formatMessage', () => {
      const mapper = createErrorMapper({
        formatMessage: (err) => `Custom: ${err.message}`,
      });
      const error = new BadRequestError('Original');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      const response = jsonSpy.mock.calls[0][0] as ErrorResponse;
      expect(response.message).toBe('Custom: Original');
    });

    it('should disable logging when logErrors is false', () => {
      const mapper = createErrorMapper({ logErrors: false });
      const error = new BadRequestError('Test');
      
      mapper(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('Error classes', () => {
    it('should have correct statusCode properties', () => {
      expect(new BadRequestError().statusCode).toBe(400);
      expect(new UnauthorizedError().statusCode).toBe(401);
      expect(new ForbiddenError().statusCode).toBe(403);
      expect(new NotFoundError().statusCode).toBe(404);
      expect(new ConflictError().statusCode).toBe(409);
      expect(new UnprocessableEntityError().statusCode).toBe(422);
      expect(new TooManyRequestsError().statusCode).toBe(429);
      expect(new InternalServerError().statusCode).toBe(500);
      expect(new NotImplementedError().statusCode).toBe(501);
      expect(new ServiceUnavailableError().statusCode).toBe(503);
    });

    it('should have correct names', () => {
      expect(new BadRequestError().name).toBe('BadRequestError');
      expect(new UnauthorizedError().name).toBe('UnauthorizedError');
      expect(new ForbiddenError().name).toBe('ForbiddenError');
      expect(new NotFoundError().name).toBe('NotFoundError');
      expect(new ConflictError().name).toBe('ConflictError');
      expect(new UnprocessableEntityError().name).toBe('UnprocessableEntityError');
      expect(new TooManyRequestsError().name).toBe('TooManyRequestsError');
      expect(new InternalServerError().name).toBe('InternalServerError');
      expect(new NotImplementedError().name).toBe('NotImplementedError');
      expect(new ServiceUnavailableError().name).toBe('ServiceUnavailableError');
    });

    it('should have default messages', () => {
      expect(new BadRequestError().message).toBe('Bad Request');
      expect(new UnauthorizedError().message).toBe('Unauthorized');
      expect(new ForbiddenError().message).toBe('Forbidden');
      expect(new NotFoundError().message).toBe('Not Found');
      expect(new ConflictError().message).toBe('Conflict');
      expect(new UnprocessableEntityError().message).toBe('Unprocessable Entity');
      expect(new TooManyRequestsError().message).toBe('Too Many Requests');
      expect(new InternalServerError().message).toBe('Internal Server Error');
      expect(new NotImplementedError().message).toBe('Not Implemented');
      expect(new ServiceUnavailableError().message).toBe('Service Unavailable');
    });
  });
});
