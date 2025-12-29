import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createAdornExpressApp } from 'adorn-api/express'
import { Controller, Get } from 'adorn-api'

@Controller('/api')
class TestController {
  @Get('/hello')
  async hello(): Promise<{ message: string }> {
    return { message: 'Hello, World!' }
  }

  @Get('/greet/{name}')
  async greet(name: string): Promise<{ message: string }> {
    return { message: `Hello, ${name}!` }
  }
}

describe('Adorn API HTTP Server', () => {
  const app = createAdornExpressApp({
    controllers: [TestController],
    openapi: { enabled: false, title: 'Test API', version: '1.0.0' },
  })

  it('should respond to GET /api/hello with a JSON message', async () => {
    const response = await request(app).get('/api/hello')
    
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/json/)
    expect(response.body).toEqual({ message: 'Hello, World!' })
  })

  it('should respond to GET /api/greet/:name with a personalized message', async () => {
    const response = await request(app).get('/api/greet/Alice')
    
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/json/)
    expect(response.body).toEqual({ message: 'Hello, Alice!' })
  })
})
