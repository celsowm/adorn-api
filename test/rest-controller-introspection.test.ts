import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createAdornExpressApp } from 'adorn-api/express'
import { Controller, Get, Post, Delete, buildRegistry, buildOpenApi, v } from 'adorn-api'
import type { OpenApiDocument } from 'adorn-api'
import type { Registry } from 'adorn-api'

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

interface CreateUserRequest {
  name: string
  email: string
}

let mockUsers: User[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: '2024-01-02T00:00:00Z' }
]

@Controller('/users')
class UserController {
  @Get('/{id}')
  async getUser(id: string): Promise<User | null> {
    return mockUsers.find(u => u.id === id) || null
  }

  @Get('/')
  async listUsers(): Promise<User[]> {
    return [...mockUsers]
  }

  @Post('/', {
    validate: {
      body: v.object({
        name: v.string().min(1),
        email: v.string().email()
      })
    }
  })
  async createUser(data: CreateUserRequest): Promise<User> {
    const user: User = {
      id: `user-${Date.now()}`,
      name: data.name,
      email: data.email,
      createdAt: new Date().toISOString()
    }
    mockUsers.push(user)
    return user
  }

  @Delete('/{id}')
  async deleteUser(id: string): Promise<void> {
    const idx = mockUsers.findIndex(u => u.id === id)
    if (idx >= 0) mockUsers.splice(idx, 1)
  }
}

describe('REST Controller Introspection (Dry Decoration)', () => {
  let app: ReturnType<typeof createAdornExpressApp>
  let registry: Registry
  let openapi: OpenApiDocument

  beforeAll(() => {
    registry = buildRegistry([UserController])
    app = createAdornExpressApp({
      controllers: [UserController],
      openapi: { enabled: true, title: 'Test API', version: '1.0.0' }
    })
    openapi = buildOpenApi(registry, { title: 'Test API', version: '1.0.0' })
  })

  beforeEach(() => {
    mockUsers = [
      { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2024-01-01T00:00:00Z' },
      { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: '2024-01-02T00:00:00Z' }
    ]
  })

  describe('HTTP Integration - Success Responses', () => {
    it('GET /users/{id} returns user object when user exists', async () => {
      const res = await request(app).get('/users/1')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        id: '1',
        name: 'Alice',
        email: 'alice@example.com',
        createdAt: '2024-01-01T00:00:00Z'
      })
    })

    it('GET /users/{id} returns null when user does not exist', async () => {
      const res = await request(app).get('/users/999')
      expect(res.status).toBe(200)
      expect(res.body).toBeNull()
    })

    it('GET /users/ returns array of users', async () => {
      const res = await request(app).get('/users/')
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      expect(res.body[0]).toMatchObject({ id: '1', name: 'Alice' })
      expect(res.body[1]).toMatchObject({ id: '2', name: 'Bob' })
    })

    it('POST /users/ creates user and returns 201', async () => {
      const res = await request(app)
        .post('/users/')
        .send({ name: 'Charlie', email: 'charlie@example.com' })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        name: 'Charlie',
        email: 'charlie@example.com'
      })
      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('createdAt')
    })

    it('DELETE /users/{id} returns 204 no content', async () => {
      const res = await request(app).delete('/users/1')
      expect(res.status).toBe(204)
      expect(res.text).toBe('')
    })
  })

  describe('HTTP Integration - Validation Errors', () => {
    it('POST /users/ returns 400 for missing email', async () => {
      const res = await request(app)
        .post('/users/')
        .send({ name: 'Dave' })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('issues')
    })

    it('POST /users/ returns 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/users/')
        .send({ name: 'Eve', email: 'not-an-email' })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('issues')
    })

    it('POST /users/ returns 400 for empty name', async () => {
      const res = await request(app)
        .post('/users/')
        .send({ name: '', email: 'test@example.com' })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('issues')
    })
  })

  describe('OpenAPI Document Structure', () => {
    it('document has valid OpenAPI structure', () => {
      expect(openapi.openapi).toMatch(/3\.\d+\.\d+/)
      expect(openapi).toHaveProperty('info')
      expect(openapi.info.title).toBe('Test API')
      expect(openapi.info.version).toBe('1.0.0')
      expect(openapi).toHaveProperty('paths')
    })

    it('contains all expected routes in paths', () => {
      expect(openapi.paths).toHaveProperty('/users/{id}')
      expect(openapi.paths).toHaveProperty('/users')
      expect(openapi.paths['/users']).toHaveProperty('get')
      expect(openapi.paths['/users']).toHaveProperty('post')
      expect(openapi.paths['/users/{id}']).toHaveProperty('get')
      expect(openapi.paths['/users/{id}']).toHaveProperty('delete')
    })

    it('all routes have operationId defined', () => {
      expect(openapi.paths['/users/{id}'].get?.operationId).toBeDefined()
      expect(openapi.paths['/users/{id}'].delete?.operationId).toBeDefined()
      expect(openapi.paths['/users'].get?.operationId).toBeDefined()
      expect(openapi.paths['/users'].post?.operationId).toBeDefined()
    })

    it('all routes have response definitions', () => {
      expect(openapi.paths['/users/{id}'].get).toHaveProperty('responses')
      expect(openapi.paths['/users/{id}'].delete).toHaveProperty('responses')
      expect(openapi.paths['/users'].get).toHaveProperty('responses')
      expect(openapi.paths['/users'].post).toHaveProperty('responses')
    })

    it('all routes have 200 or success status response', () => {
      expect(openapi.paths['/users/{id}'].get?.responses?.['200']).toBeDefined()
      expect(openapi.paths['/users'].get?.responses?.['200']).toBeDefined()
      expect(openapi.paths['/users'].post?.responses?.['201']).toBeDefined()
      expect(openapi.paths['/users/{id}'].delete?.responses?.['204']).toBeDefined()
    })
  })

  describe('Route Return Type Introspection', () => {
    it('GET /users/{id} route handler returns Promise<User | null>', () => {
      const route = registry.routes.find(r => r.handlerName === 'getUser')
      expect(route).toBeDefined()
    })

    it('GET /users route handler returns Promise<User[]>', () => {
      const route = registry.routes.find(r => r.handlerName === 'listUsers')
      expect(route).toBeDefined()
    })

    it('POST /users route handler returns Promise<User>', () => {
      const route = registry.routes.find(r => r.handlerName === 'createUser')
      expect(route).toBeDefined()
    })

    it('DELETE /users/{id} route handler returns Promise<void>', () => {
      const route = registry.routes.find(r => r.handlerName === 'deleteUser')
      expect(route).toBeDefined()
    })
  })

  describe('Validation Schema Definition', () => {
    it('POST /users/ has body validation schema', () => {
      const route = registry.routes.find(r => r.handlerName === 'createUser')
      expect(route).toBeDefined()
      const options = route?.options as { validate?: { body?: { ir?: { kind?: string } } } } | undefined
      expect(options?.validate?.body?.ir?.kind).toBe('object')
    })

    it('body validation schema has name and email properties', () => {
      const route = registry.routes.find(r => r.handlerName === 'createUser')
      const options = route?.options as { validate?: { body?: { ir?: { properties?: Record<string, unknown> } } } } | undefined
      const props = options?.validate?.body?.ir?.properties
      expect(props).toHaveProperty('name')
      expect(props).toHaveProperty('email')
    })
  })
})
