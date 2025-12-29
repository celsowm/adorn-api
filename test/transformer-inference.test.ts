import { describe, it, expect } from 'vitest'
import { Controller, Delete, Get, Post, buildRegistry } from 'adorn-api'
import type { RouteOptions } from 'adorn-api'
import type { SchemaIR } from 'adorn-api/validation/native/ir.js'

interface Widget {
  id: string
  name: string
  tags?: string[] | undefined
}

interface CreateWidget {
  name: string
  tags?: string[] | undefined
}

interface WidgetFilters {
  search?: string | undefined
  limit?: number | undefined
}

@Controller('/widgets')
class TransformerController {
  @Get('/')
  async listWidgets(filters: WidgetFilters): Promise<Widget[]> {
    void filters
    return []
  }

  @Get('/{id}')
  async getWidget(id: string, status?: string, /** @ctx */ ctx?: unknown): Promise<Widget> {
    void ctx
    return { id, name: status ?? 'widget' }
  }

  @Post('/{id}')
  async updateWidget(id: string, body: CreateWidget, mode?: number): Promise<Widget> {
    void mode
    return { id, name: body.name, tags: body.tags }
  }

  @Delete('/{id}')
  async deleteWidget(id: string): Promise<void> {
    void id
  }
}

describe('Transformer inference', () => {
  const registry = buildRegistry([TransformerController])
  type RouteOptionsAny = RouteOptions<string>

  const routeByHandler = (name: string) => {
    const route = registry.routes.find((r) => r.handlerName === name)
    expect(route).toBeTruthy()
    return route!
  }

  const optionsFor = (routeName: string) => {
    const route = routeByHandler(routeName)
    expect(route.options).toBeTruthy()
    return route.options as RouteOptionsAny
  }

  it('infers query object bindings and schema from listWidgets', () => {
    const opts = optionsFor('listWidgets')

    expect(opts.bindings).toMatchObject({
      args: [{ kind: 'query' }],
    })

    const query = opts.validate?.query
    expect(query?.ir.kind).toBe('object')
    expect(query?.ir.properties).toMatchObject({
      search: { kind: 'string' },
      limit: { kind: 'number' },
    })
    expect(query?.ir.required ?? []).toEqual([])
    expect(query?.ir.strict).toBe(true)

    const responseSchema = opts.responses?.['200'] as { ir?: { kind?: string } } | undefined
    expect(responseSchema?.ir?.kind).toBe('array')
  })

  it('infers path/query bindings and schemas from getWidget', () => {
    const opts = optionsFor('getWidget')

    expect(opts.bindings?.args).toEqual([
      { kind: 'path', name: 'id', type: 'string' },
      { kind: 'query', name: 'status', type: 'string' },
      { kind: 'ctx' },
    ])
    expect(opts.bindings?.path).toEqual({ id: 'string' })

    const params = opts.validate?.params
    expect(params?.ir.kind).toBe('object')
    expect(params?.ir.properties).toMatchObject({
      id: { kind: 'string' },
    })
    expect(params?.ir.required).toEqual(['id'])
    expect(params?.ir.strict).toBe(true)

    const query = opts.validate?.query
    expect(query?.ir.properties).toMatchObject({
      status: { kind: 'string' },
    })
    expect(query?.ir.required ?? []).toEqual([])

    const responseSchema = opts.responses?.['200'] as { ir?: { kind?: string } } | undefined
    expect(responseSchema?.ir?.kind).toBe('object')
  })

  it('infers body bindings and response status from updateWidget', () => {
    const opts = optionsFor('updateWidget')

    expect(opts.bindings?.args).toEqual([
      { kind: 'path', name: 'id', type: 'string' },
      { kind: 'body' },
      { kind: 'query', name: 'mode', type: 'number' },
    ])

    const body = opts.validate?.body
    expect(body?.ir.kind).toBe('object')
    expect(body?.ir.properties).toMatchObject({
      name: { kind: 'string' },
      tags: { kind: 'array' },
    })
    expect(body?.ir.required).toEqual(['name'])
    expect(body?.ir.strict).toBe(true)

    const responseSchema = opts.responses?.['201'] as { ir?: { kind?: string } } | undefined
    expect(responseSchema?.ir?.kind).toBe('object')
  })

  it('sets delete success status when no body is returned', () => {
    const opts = optionsFor('deleteWidget')
    expect(opts.successStatus).toBe(204)
  })
})
