# Usage Patterns and Edge Cases in Adorn API

This document provides comprehensive examples of usage patterns, edge cases, and best practices for working with Adorn API.

## Table of Contents

1. [Decorator Usage Patterns](#decorator-usage-patterns)
2. [Route Configuration Patterns](#route-configuration-patterns)
3. [Error Handling Patterns](#error-handling-patterns)
4. [Advanced Binding Patterns](#advanced-binding-patterns)
5. [Edge Cases and Troubleshooting](#edge-cases-and-troubleshooting)
6. [Performance Patterns](#performance-patterns)

## Decorator Usage Patterns

### Method Decorator Patterns

```typescript
// Basic usage with path only
@Get('/users')
async listUsers() {
  return await userService.findAll();
}

// With route options
@Post('/users', {
  summary: 'Create new user',
  description: 'Creates a new user with the provided data',
  tags: ['Users'],
  operationId: 'createUser',
  responses: {
    201: { description: 'User created' },
    400: { description: 'Invalid user data' }
  }
})
async createUser(userData: CreateUserDto) {
  return await userService.create(userData);
}

// With validation
@Put('/users/:id', {
  validate: {
    params: Schema.Object({
      id: Schema.String().format('uuid')
    }),
    body: Schema.Object({
      name: Schema.String().minLength(3),
      email: Schema.String().format('email')
    })
  }
})
async updateUser(id: string, userData: UpdateUserDto) {
  return await userService.update(id, userData);
}

// With parameter binding hints
@Get('/users/:id/:status', {
  bindings: {
    path: {
      id: 'uuid',
      status: 'string'
    }
  }
})
async getUserByStatus(id: string, status: string) {
  return await userService.findByIdAndStatus(id, status);
}
```

### Controller Decorator Patterns

```typescript
// Basic controller
@Controller('/api/v1')
class UserController {
  // Routes will be prefixed with /api/v1
}

// Controller with base path
@Controller('/api/v1/users')
class UserController {
  // Routes will be prefixed with /api/v1/users
  @Get('/')        // Full path: /api/v1/users/
  @Get('/:id')      // Full path: /api/v1/users/:id
  @Post('/')       // Full path: /api/v1/users/
}

// Controller with security
@Controller('/admin', {
  security: [{ adminAuth: [] }]
})
class AdminController {
  // All routes inherit admin security requirement
}
```

### Documentation Decorator Patterns

```typescript
// Tags decorator
@Tags('Users', 'API')
class UserController {
  // All routes in this controller will have these tags
}

// OperationId decorator
@OperationId('getUserById')
@Get('/users/:id')
async getUser(id: string) {
  // This route will have operationId: 'getUserById'
}

// Deprecated decorator
@Deprecated()
@Get('/legacy/users')
async legacyGetUsers() {
  // This route will be marked as deprecated in OpenAPI
}

// Method-level documentation
@Tags('Users')
@OperationId('listUsers')
@Get('/users')
async listUsers() {
  // Combines controller and method documentation
}
```

## Route Configuration Patterns

### Response Configuration Patterns

```typescript
// Basic response configuration
const route = defineRoute('/users/:id', {
  responses: {
    200: { description: 'User found' },
    404: { description: 'User not found' }
  }
});

// Response with content specification
const userRoute = defineRoute('/users/:id', {
  responses: {
    200: {
      description: 'User found',
      content: {
        'application/json': {
          schema: userSchema,
          example: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'John Doe',
            email: 'john@example.com'
          }
        }
      }
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: errorSchema
        }
      }
    }
  }
});

// Multiple content types
const flexibleRoute = defineRoute('/users/export', {
  responses: {
    200: {
      description: 'User data',
      content: {
        'application/json': {
          schema: userArraySchema
        },
        'text/csv': {
          schema: Schema.String()
        }
      }
    }
  }
});

// Response with headers
const routeWithHeaders = defineRoute('/users/:id', {
  responses: {
    200: {
      description: 'User found',
      headers: {
        'X-User-Count': {
          schema: Schema.Number(),
          description: 'Total number of users'
        },
        'X-Rate-Limit': {
          schema: Schema.Number(),
          description: 'Remaining requests in current window'
        }
      },
      content: {
        'application/json': {
          schema: userSchema
        }
      }
    }
  }
});
```

### Validation Configuration Patterns

```typescript
// Basic validation
const validatedRoute = defineRoute('/users', {
  validate: {
    body: Schema.Object({
      name: Schema.String().minLength(3),
      email: Schema.String().format('email'),
      age: Schema.Number().min(18)
    })
  }
});

// Complex validation with nested objects
const complexValidation = defineRoute('/users', {
  validate: {
    body: Schema.Object({
      user: Schema.Object({
        name: Schema.String().minLength(3),
        email: Schema.String().format('email'),
        address: Schema.Object({
          street: Schema.String().minLength(5),
          city: Schema.String().minLength(2),
          zipCode: Schema.String().regex(/^\d{5}(-\d{4})?$/)
        })
      }),
      preferences: Schema.Object({
        newsletter: Schema.Boolean(),
        notifications: Schema.Boolean()
      })
    })
  }
});

// Validation with arrays
const arrayValidation = defineRoute('/users/bulk', {
  validate: {
    body: Schema.Object({
      users: Schema.Array(
        Schema.Object({
          name: Schema.String().minLength(3),
          email: Schema.String().format('email')
        })
      ).minLength(1).maxLength(100)
    })
  }
});

// Validation with discriminated unions
const unionValidation = defineRoute('/events', {
  validate: {
    body: Schema.Union(
      Schema.Object({
        type: Schema.Literal('user_created'),
        userId: Schema.String().format('uuid'),
        email: Schema.String().format('email')
      }),
      Schema.Object({
        type: Schema.Literal('user_deleted'),
        userId: Schema.String().format('uuid')
      })
    )
  }
});
```

## Error Handling Patterns

### Basic Error Handling

```typescript
// Simple error response
@Get('/users/:id')
async getUser(id: string) {
  const user = await userService.findById(id);
  if (!user) {
    throw new HttpError(404, 'User not found', {
      code: 'USER_NOT_FOUND',
      details: { id }
    });
  }
  return reply(200, user);
}

// Using HttpError
@Post('/users')
async createUser(userData: CreateUserDto) {
  try {
    const createdUser = await userService.create(userData);
    return reply(201, createdUser);
  } catch (error) {
    if (error.code === 'DUPLICATE_EMAIL') {
      throw new HttpError(409, 'Email already exists', {
        code: 'DUPLICATE_EMAIL',
        details: { email: userData.email }
      });
    }
    throw new HttpError(400, 'Invalid user data', {
      code: 'INVALID_USER_DATA',
      details: error.message
    });
  }
}

// Validation error handling
@Put('/users/:id')
async updateUser(id: string, userData: UpdateUserDto) {
  const validationResult = await validator.validate(userData, updateUserSchema);
  if (!validationResult.ok) {
    throw ValidationError.fromIssues(validationResult.issues);
  }
  
  const updatedUser = await userService.update(id, validationResult.value);
  return reply(200, updatedUser);
}
```

### Advanced Error Handling

```typescript
// Custom error handler middleware
function customErrorHandler() {
  return async (ctx: RequestContext, next: NextFunction) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof HttpError) {
        // Log structured error information
        logger.error({
          error: error.message,
          code: error.code,
          status: error.status,
          details: error.details,
          stack: error.expose ? error.stack : undefined
        });
        
        // Add request ID to error response
        return reply(error.status, {
          ...error,
          requestId: ctx.requestId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Unexpected errors
      logger.error({
        error: 'Unexpected error',
        message: error.message,
        stack: error.stack
      });
      
      return reply(500, {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId: ctx.requestId,
        timestamp: new Date().toISOString()
      });
    }
  };
}

// Error handling with different response formats
class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public message: string,
    public details?: any,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiErrorHandler() {
  return async (ctx: RequestContext, next: NextFunction) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof ApiError) {
        return reply(error.status, {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
          requestId: error.requestId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Convert other errors to ApiError format
      const apiError = new ApiError(
        500,
        'INTERNAL_ERROR',
        'Internal server error',
        undefined,
        ctx.requestId
      );
      
      return reply(500, {
        success: false,
        error: apiError.message,
        code: apiError.code,
        requestId: apiError.requestId,
        timestamp: new Date().toISOString()
      });
    }
  };
}
```

### Error Handling Best Practices

```typescript
// 1. Use appropriate HTTP status codes
// 200-299: Success
// 400-499: Client errors
// 500-599: Server errors

// 2. Provide meaningful error codes
// USE_CODES like 'USER_NOT_FOUND', 'INVALID_INPUT', etc.

// 3. Include error details when appropriate
// But be careful not to expose sensitive information

// 4. Log errors for debugging
// Always log errors on the server side

// 5. Use consistent error response format
// Standardize error responses across your API

// 6. Handle validation errors specifically
// Use ValidationError for validation failures

// 7. Don't expose internal implementation details
// Use error.expose = false for sensitive errors

// 8. Include request IDs for correlation
// Helps with debugging and support

// 9. Document error responses in OpenAPI
// Include error responses in your API documentation

// 10. Test error scenarios
// Ensure your error handling works as expected
```

## Advanced Binding Patterns

### Path Parameter Binding

```typescript
// Basic path parameter binding
@Get('/users/:id')
async getUser(id: string) {
  // id is automatically extracted from path
  return await userService.findById(id);
}

// Typed path parameter binding
@Get('/users/:id', {
  bindings: {
    path: { id: 'uuid' }
  }
})
async getUser(id: string) {
  // id is automatically coerced to string (UUID format)
  return await userService.findById(id);
}

// Multiple path parameters
@Get('/users/:userId/posts/:postId', {
  bindings: {
    path: {
      userId: 'uuid',
      postId: 'uuid'
    }
  }
})
async getUserPost(userId: string, postId: string) {
  // Both parameters are automatically extracted and typed
  return await postService.findByUserAndId(userId, postId);
}

// Path parameter with custom type
@Get('/users/:status', {
  bindings: {
    path: { status: 'string' }
  }
})
async getUsersByStatus(status: string) {
  // status is automatically extracted
  return await userService.findByStatus(status);
}
```

### Query Parameter Binding

```typescript
// Automatic query parameter binding
@Get('/users')
async listUsers(query: ListUsersQuery) {
  // Query parameters are automatically bound to the query object
  return await userService.findPaginated(query);
}

// Query parameter with validation
@Get('/users', {
  validate: {
    query: Schema.Object({
      page: Schema.Number().min(1).default(1),
      limit: Schema.Number().min(1).max(100).default(20),
      status: Schema.String().optional()
    })
  }
})
async listUsers(page: number, limit: number, status?: string) {
  // Query parameters are validated and typed
  return await userService.findPaginated({ page, limit, status });
}

// Complex query parameters
@Get('/users/search', {
  validate: {
    query: Schema.Object({
      q: Schema.String().optional(),
      filters: Schema.String().optional(),
      sort: Schema.String().optional(),
      page: Schema.Number().min(1).default(1),
      limit: Schema.Number().min(1).max(100).default(20)
    })
  }
})
async searchUsers(
  q?: string,
  filters?: string,
  sort?: string,
  page: number = 1,
  limit: number = 20
) {
  // Complex query parameters with defaults
  return await userService.search({ q, filters, sort, page, limit });
}
```

### Body Parameter Binding

```typescript
// Basic body binding
@Post('/users')
async createUser(userData: CreateUserDto) {
  // Request body is automatically parsed and validated
  return await userService.create(userData);
}

// Body with validation
@Post('/users', {
  validate: {
    body: Schema.Object({
      name: Schema.String().minLength(3),
      email: Schema.String().format('email'),
      password: Schema.String().minLength(8)
    })
  }
})
async createUser(userData: CreateUserDto) {
  // Body is validated against schema
  return await userService.create(userData);
}

// Partial body for PATCH
@Patch('/users/:id', {
  validate: {
    body: Schema.Object({
      name: Schema.String().minLength(3).optional(),
      email: Schema.String().format('email').optional(),
      status: Schema.String().optional()
    })
  }
})
async updateUser(id: string, partialData: Partial<User>) {
  // Partial body for PATCH operations
  return await userService.update(id, partialData);
}

// Body with nested objects
@Post('/users', {
  validate: {
    body: Schema.Object({
      user: Schema.Object({
        name: Schema.String().minLength(3),
        email: Schema.String().format('email'),
        address: Schema.Object({
          street: Schema.String().minLength(5),
          city: Schema.String().minLength(2),
          zipCode: Schema.String().regex(/^\d{5}(-\d{4})?$/)
        })
      }),
      preferences: Schema.Object({
        newsletter: Schema.Boolean(),
        notifications: Schema.Boolean()
      })
    })
  }
})
async createUser(userData: CreateUserWithPreferencesDto) {
  // Complex nested body structure
  return await userService.createWithPreferences(userData);
}
```

### Header Parameter Binding

```typescript
// Basic header binding
@Get('/users/:id')
async getUser(id: string, @Header('Authorization') authHeader?: string) {
  // Authorization header is automatically extracted
  return await userService.findById(id);
}

// Multiple headers
@Post('/users')
async createUser(
  userData: CreateUserDto,
  requestId?: string,
  clientVersion?: string
) {
  // Multiple headers extracted
  logger.info(`Request ${requestId} from client ${clientVersion}`);
  return await userService.create(userData);
}

// Header validation
@Get('/admin/users', {
  validate: {
    headers: Schema.Object({
      'X-Admin-Token': Schema.String().minLength(32)
    })
  }
})
async listAdminUsers(@Header('X-Admin-Token') adminToken: string) {
  // Header is validated
  return await adminService.listUsers(adminToken);
}
```

### Context Parameter Binding

```typescript
// Basic context binding
@Get('/users/:id')
async getUser(id: string, ctx: RequestContext) {
  // Full request context is available
  logger.info(`Request from ${ctx.ip} for user ${id}`);
  return await userService.findById(id);
}

// Context with request information
@Post('/users')
async createUser(userData: CreateUserDto, ctx: RequestContext) {
  // Access request information
  logger.info(`Create user request from ${ctx.ip}`, {
    userAgent: ctx.userAgent,
    requestId: ctx.requestId
  });
  
  // Access headers
  const clientVersion = ctx.headers['x-client-version'];
  
  return await userService.create(userData);
}

// Context with response manipulation
@Get('/users/:id')
async getUser(id: string, ctx: RequestContext) {
  const user = await userService.findById(id);
  
  // Set custom response headers
  ctx.setHeader('X-User-Count', await userService.count());
  ctx.setHeader('Cache-Control', 'public, max-age=3600');
  
  return user;
}
```

## Edge Cases and Troubleshooting

### Common Edge Cases

```typescript
// 1. Optional vs Required Parameters
// Use ? for optional parameters, but be careful with validation

// 2. Default Values
// Provide sensible defaults for optional parameters

// 3. Type Coercion
// Be aware of automatic type coercion in query parameters

// 4. Case Sensitivity
// Route paths are case-sensitive by default

// 5. Trailing Slashes
// Adorn normalizes trailing slashes automatically

// 6. Special Characters
// URL-encode special characters in paths and queries

// 7. Large Payloads
// Consider streaming for large request/response bodies

// 8. File Uploads
// Use appropriate middleware for file uploads

// 9. CORS
// Configure CORS properly for cross-origin requests

// 10. Rate Limiting
// Implement rate limiting for public APIs
```

### Troubleshooting Patterns

```typescript
// 1. Debugging Route Matching
// Check the registry to see what routes are registered

// 2. Validation Errors
// Check validation schemas and error messages

// 3. Parameter Binding
// Verify binding configuration and types

// 4. Middleware Order
// Ensure middleware is in the correct order

// 5. Error Handling
// Check error handler configuration

// 6. OpenAPI Generation
// Verify route metadata and responses

// 7. TypeScript Errors
// Check for type mismatches and missing types

// 8. Runtime Errors
// Check error logs and stack traces

// 9. Performance Issues
// Profile request handling and database queries

// 10. Memory Leaks
// Monitor memory usage over time
```

### Error Recovery Patterns

```typescript
// 1. Retry Logic
// Implement retry logic for transient errors

// 2. Circuit Breakers
// Use circuit breakers for external dependencies

// 3. Fallback Responses
// Provide fallback responses when possible

// 4. Graceful Degradation
// Degrade functionality gracefully under load

// 5. Request Timeouts
// Set appropriate timeouts for external calls

// 6. Bulkhead Isolation
// Isolate critical resources

// 7. Rate Limiting
// Protect against abuse and overload

// 8. Caching
// Cache responses to reduce load

// 9. Queueing
// Queue requests during peak loads

// 10. Health Checks
// Implement comprehensive health checks
```

## Performance Patterns

### Caching Patterns

```typescript
// 1. Response Caching
// Cache frequent responses to reduce load

// 2. Database Caching
// Cache database query results

// 3. Rate Limiting
// Protect against abuse and overload

// 4. Connection Pooling
// Reuse database connections

// 5. Batch Processing
// Process requests in batches

// 6. Lazy Loading
// Load data only when needed

// 7. Pagination
// Implement proper pagination

// 8. Compression
// Compress responses when appropriate

// 9. CDN Usage
// Use CDNs for static assets

// 10. Load Balancing
// Distribute load across servers
```

### Optimization Patterns

```typescript
// 1. Database Indexing
// Ensure proper database indexes

// 2. Query Optimization
// Optimize database queries

// 3. Connection Management
// Manage database connections efficiently

// 4. Memory Management
// Monitor and manage memory usage

// 5. Garbage Collection
// Understand GC behavior

// 6. Event Loop Management
// Avoid blocking the event loop

// 7. Async/Await
// Use async/await properly

// 8. Error Handling
// Handle errors efficiently

// 9. Logging
// Log appropriately for production

// 10. Monitoring
// Implement comprehensive monitoring
```

### Scaling Patterns

```typescript
// 1. Horizontal Scaling
// Scale by adding more instances

// 2. Vertical Scaling
// Scale by increasing instance size

// 3. Microservices
// Consider microservices architecture

// 4. Serverless
// Consider serverless for some workloads

// 5. Containerization
// Use containers for deployment

// 6. Orchestration
// Use orchestration for management

// 7. Auto-scaling
// Implement auto-scaling policies

// 8. Load Testing
// Test under realistic loads

// 9. Capacity Planning
// Plan for growth

// 10. Disaster Recovery
// Implement disaster recovery plans
```

This comprehensive documentation provides patterns and best practices for working with Adorn API, covering common usage scenarios, advanced patterns, edge cases, and performance considerations.