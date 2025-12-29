import { describe, it, expect } from 'vitest'
import { Bindings, Controller, Get, Post, buildOpenAiTools, buildRegistry, v } from 'adorn-api'

@Controller('/ai')
class OpenAiSchemaController {
  @Get('/users/{userId}', {
    operationId: 'fetchUser',
    validate: {
      params: v.object({ userId: v.string().min(1) }),
      query: v.object({
        verbose: v.boolean().optional(),
        limit: v.number().int().min(1).max(100).optional(),
      }),
    },
  })
  async fetchUser(): Promise<void> {
    return
  }

  @Bindings({ path: { userId: 'uuid' } })
  @Post('/users/{userId}/notes', {
    operationId: 'addNote',
    validate: {
      body: v.object({
        note: v.string().min(1),
        tags: v.array(v.string()).optional(),
      }),
    },
  })
  async addNote(): Promise<void> {
    return
  }
}

describe('OpenAI tools JSON schema', () => {
  const registry = buildRegistry([OpenAiSchemaController])
  const toolset = buildOpenAiTools(registry)

  it('builds parameters from path and query schemas', () => {
    const tool = toolset.tools.find((t) => t.function.name === 'fetchUser')
    expect(tool).toBeTruthy()

    const params = tool?.function.parameters as Record<string, unknown>
    expect(params).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        userId: { type: 'string', minLength: 1 },
        query: {
          type: 'object',
          properties: {
            verbose: { type: 'boolean' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    })
    expect(params.required).toEqual(['userId'])
  })

  it('uses path hints and marks body as required', () => {
    const tool = toolset.tools.find((t) => t.function.name === 'addNote')
    expect(tool).toBeTruthy()

    const params = tool?.function.parameters as Record<string, unknown>
    expect(params).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        userId: { type: 'string', format: 'uuid' },
        body: {
          type: 'object',
          properties: {
            note: { type: 'string', minLength: 1 },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['note'],
        },
      },
    })
    expect(params.required).toEqual(['userId', 'body'])
  })
})
