# Response Building Patterns in Adorn API

This document provides comprehensive examples and patterns for building responses in Adorn API.

## Table of Contents

1. [Basic Response Patterns](#basic-response-patterns)
2. [Typed Response Patterns](#typed-response-patterns)
3. [Error Response Patterns](#error-response-patterns)
4. [Advanced Response Patterns](#advanced-response-patterns)
5. [Response Customization](#response-customization)

## Basic Response Patterns

### Simple JSON Responses

```typescript
import { reply } from '@adorn/api';

// Basic success response
@Get('/users')
async listUsers() {
  const users = await userService.findAll();
  return reply(200, users);
}

// Single resource response
@Get('/users/:id')
async getUser(id: string) {
  const user = await userService.findById(id);
  return reply(200, user);
}

// Creation response
@Post('/users')
async createUser(@Body() userData: CreateUserDto) {
  const createdUser = await userService.create(userData);
  return reply(201, createdUser);
}
```

### No Content Responses

```typescript
import { noContent } from '@adorn/api';

// Standard DELETE response
@Delete('/users/:id')
async deleteUser(id: string) {
  await userService.delete(id);
  return noContent(); // 204 No Content
}

// Custom no-content status
@Post('/users/bulk-delete')
async bulkDelete(ids: string[]) {
  await userService.bulkDelete(ids);
  return noContent(202); // 202 Accepted
}
```

### Error Responses

```typescript
import { reply } from '@adorn/api';
import { HttpError } from '@adorn/api';

// Explicit error response
@Get('/users/:id')
async getUser(id: string) {
  const user = await userService.findById(id);
  if (!user) {
    return reply(404, {
      error: 'User not found',
      code: 'USER_NOT_FOUND',
      details: { id }
    });
  }
  return reply(200, user);
}

// Using HttpError (automatically handled by error middleware)
@Post('/users')
async createUser(@Body() userData: CreateUserDto) {
  try {
    const createdUser = await userService.create(userData);
    return reply(201, createdUser);
  } catch (error) {
    throw new HttpError(400, 'Invalid user data', {
      code: 'INVALID_USER_DATA',
      details: error.message
    });
  }
}
```

## Typed Response Patterns

### Using Route Definitions with Typed Replies

```typescript
import { defineRoute, routeFor } from '@adorn/api';
import { Schema } from '@adorn/api';

// Define user schema
const userSchema = Schema.Object({
  id: Schema.String().format('uuid'),
  name: Schema.String(),
  email: Schema.String().format('email'),
  createdAt: Schema.String().format('date-time')
});

// Define error schema
const errorSchema = Schema.Object({
  error: Schema.String(),
  code: Schema.String(),
  details: Schema.Any().optional()
});

// Route with typed responses
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
            email: 'john@example.com',
            createdAt: '2023-01-01T00:00:00Z'
          }
        }
      }
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: errorSchema,
          example: {
            error: 'User not found',
            code: 'USER_NOT_FOUND',
            details: { id: 'non-existent-id' }
          }
        }
      }
    }
  }
});

class UserController {
  @Get('/users/:id')
  async getUser(id: string) {
    const user = await userService.findById(id);
    if (!user) {
      // Type-safe error response
      return userRoute.reply(404, {
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        details: { id }
      });
    }
    
    // Type-safe success response
    return userRoute.reply(200, user);
  }
}
```

### Builder Pattern for Routes

```typescript
// Using the builder pattern
const createUserRoute = routeFor('/users')({
  responses: {
    201: {
      description: 'User created',
      content: {
        'application/json': {
          schema: userSchema,
          example: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Jane Smith',
            email: 'jane@example.com',
            createdAt: '2023-01-01T00:00:00Z'
          }
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: errorSchema
        }
      }
    }
  }
});

class UserController {
  @Post('/users')
  async createUser(@Body() userData: CreateUserDto) {
    try {
      const createdUser = await userService.create(userData);
      return createUserRoute.reply(201, createdUser);
    } catch (error) {
      return createUserRoute.reply(400, {
        error: 'Invalid user data',
        code: 'INVALID_USER_DATA',
        details: error.message
      });
    }
  }
}
```

## Error Response Patterns

### Standard Error Responses

```typescript
// 400 Bad Request
return reply(400, {
  error: 'Invalid input',
  code: 'INVALID_INPUT',
  details: validationErrors
});

// 401 Unauthorized
return reply(401, {
  error: 'Unauthorized',
  code: 'UNAUTHORIZED',
  details: 'Authentication required'
});

// 403 Forbidden
return reply(403, {
  error: 'Forbidden',
  code: 'FORBIDDEN',
  details: 'Insufficient permissions'
});

// 404 Not Found
return reply(404, {
  error: 'Resource not found',
  code: 'NOT_FOUND',
  details: { resource: 'user', id: '123' }
});

// 409 Conflict
return reply(409, {
  error: 'Conflict',
  code: 'CONFLICT',
  details: 'Email already exists'
});

// 500 Internal Server Error
return reply(500, {
  error: 'Internal server error',
  code: 'INTERNAL_ERROR',
  details: 'An unexpected error occurred'
});
```

### Using HttpError for Automatic Error Handling

```typescript
// The framework automatically converts HttpError to appropriate responses

// Validation error
throw new HttpError(400, 'Validation failed', {
  code: 'VALIDATION_ERROR',
  details: validationIssues
});

// Not found error
throw new HttpError(404, 'User not found', {
  code: 'USER_NOT_FOUND',
  details: { id: '123' }
});

// Authentication error
throw new HttpError(401, 'Unauthorized', {
  code: 'UNAUTHORIZED',
  details: 'Invalid or missing token'
});

// Permission error
throw new HttpError(403, 'Forbidden', {
  code: 'FORBIDDEN',
  details: 'Insufficient permissions for this resource'
});

// Custom error with specific exposure
throw new HttpError(500, 'Database connection failed', {
  code: 'DATABASE_ERROR',
  details: { error: 'Connection timeout' },
  expose: false // Don't expose details to client
});
```

## Advanced Response Patterns

### Responses with Custom Headers

```typescript
// Response with Location header (common for POST operations)
@Post('/users')
async createUser(@Body() userData: CreateUserDto) {
  const createdUser = await userService.create(userData);
  return reply(201, createdUser, {
    headers: {
      'Location': `/users/${createdUser.id}`,
      'X-Resource-ID': createdUser.id
    }
  });
}

// Response with caching headers
@Get('/users/:id')
async getUser(id: string) {
  const user = await userService.findById(id);
  return reply(200, user, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'ETag': generateETag(user),
      'Last-Modified': user.updatedAt.toUTCString()
    }
  });
}

// Response with pagination headers
@Get('/users')
async listUsers(@Query() query: ListUsersQuery) {
  const { users, total, page, limit } = await userService.findPaginated(query);
  return reply(200, users, {
    headers: {
      'X-Total-Count': total.toString(),
      'X-Page': page.toString(),
      'X-Per-Page': limit.toString(),
      'X-Total-Pages': Math.ceil(total / limit).toString()
    }
  });
}
```

### Conditional Responses

```typescript
// Conditional GET with ETag support
@Get('/users/:id')
async getUser(id: string, @Header('If-None-Match') ifNoneMatch?: string) {
  const user = await userService.findById(id);
  const currentETag = generateETag(user);
  
  if (ifNoneMatch === currentETag) {
    return noContent(304); // 304 Not Modified
  }
  
  return reply(200, user, {
    headers: {
      'ETag': currentETag,
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

// Conditional response based on request headers
@Get('/users/:id')
async getUser(id: string, @Header('Accept') accept?: string) {
  const user = await userService.findById(id);
  
  if (accept?.includes('application/xml')) {
    const xmlUser = convertUserToXml(user);
    return reply(200, xmlUser, {
      headers: { 'Content-Type': 'application/xml' }
    });
  }
  
  return reply(200, user);
}
```

### Streaming Responses

```typescript
// File download response
@Get('/users/:id/avatar')
async getAvatar(id: string) {
  const fileStream = await userService.getAvatarStream(id);
  
  return reply(200, fileStream, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="avatar-${id}.jpg"`,
      'Content-Length': fileStream.size.toString()
    }
  });
}

// CSV export response
@Get('/users/export')
async exportUsers() {
  const csvStream = await userService.exportToCsv();
  
  return reply(200, csvStream, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="users.csv"'
    }
  });
}
```

## Response Customization

### Custom Response Types

```typescript
// Define custom response types
type ApiResponse<T> = {
  success: true;
  data: T;
  timestamp: string;
};

type ApiError = {
  success: false;
  error: string;
  code: string;
  timestamp: string;
};

// Standardized success response
@Get('/users/:id')
async getUser(id: string) {
  const user = await userService.findById(id);
  const response: ApiResponse<User> = {
    success: true,
    data: user,
    timestamp: new Date().toISOString()
  };
  return reply(200, response);
}

// Standardized error response
@Get('/users/:id')
async getUser(id: string) {
  const user = await userService.findById(id);
  if (!user) {
    const error: ApiError = {
      success: false,
      error: 'User not found',
      code: 'USER_NOT_FOUND',
      timestamp: new Date().toISOString()
    };
    return reply(404, error);
  }
  return reply(200, { success: true, data: user, timestamp: new Date().toISOString() });
}
```

### Response Wrapping Middleware

```typescript
// Create response wrapping middleware
function wrapResponseMiddleware() {
  return async (ctx: RequestContext, next: NextFunction) => {
    try {
      const result = await next();
      
      if (isReply(result)) {
        // Wrap successful responses
        return reply(result.status, {
          success: true,
          data: result.body,
          timestamp: new Date().toISOString(),
          requestId: ctx.requestId
        }, {
          headers: result.headers
        });
      }
      
      // Wrap direct returns
      return reply(200, {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: ctx.requestId
      });
      
    } catch (error) {
      // Wrap error responses
      if (error instanceof HttpError) {
        return reply(error.status, {
          success: false,
          error: error.message,
          code: error.code ?? 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
          requestId: ctx.requestId,
          ...(error.expose ? { details: error.details } : {})
        });
      }
      
      // Unexpected errors
      return reply(500, {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        requestId: ctx.requestId
      });
    }
  };
}

// Use the middleware in your Express app
app.use(wrapResponseMiddleware());
```

## Best Practices

### Response Consistency

1. **Standardize response formats** across your API
2. **Use consistent status codes** for similar operations
3. **Include timestamps** in responses for debugging
4. **Use proper content types** and headers
5. **Document all responses** in OpenAPI specification

### Error Handling

1. **Use HttpError** for consistent error handling
2. **Provide meaningful error codes** for programmatic handling
3. **Include error details** when appropriate (consider security)
4. **Use proper HTTP status codes** for errors
5. **Log errors** on the server side for debugging

### Performance

1. **Use appropriate caching headers** for cacheable responses
2. **Consider response compression** for large payloads
3. **Use streaming** for large file downloads
4. **Avoid sending sensitive data** in responses
5. **Use pagination** for large collections

## Integration with OpenAPI

The response patterns shown here integrate seamlessly with OpenAPI documentation:

```typescript
const userRoute = defineRoute('/users/:id', {
  responses: {
    200: {
      description: 'User found',
      content: {
        'application/json': {
          schema: userSchema,
          example: {
            success: true,
            data: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              name: 'John Doe',
              email: 'john@example.com'
            },
            timestamp: '2023-01-01T00:00:00Z'
          }
        }
      }
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: errorSchema,
          example: {
            success: false,
            error: 'User not found',
            code: 'USER_NOT_FOUND',
            timestamp: '2023-01-01T00:00:00Z'
          }
        }
      }
    }
  }
});
```

This documentation provides a comprehensive guide to response building patterns in Adorn API, covering everything from basic responses to advanced patterns and best practices.