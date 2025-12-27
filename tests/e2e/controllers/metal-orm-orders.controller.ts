import {
  count,
  deleteFrom,
  entityRef,
  eq,
  getTableDefFromEntity,
  insertInto,
  max,
  selectFrom,
  selectFromEntity,
  tableRef,
  update,
  type OrmSession,
} from 'metal-orm';
import { z } from 'zod';
import {
  Controller,
  Delete,
  EmptyBody,
  EmptyQuery,
  EmptyResponse,
  Get,
  NotFoundError,
  Patch,
  Post,
  Put,
  defineEntityApi,
  extractEntityDtos,
  named,
  type EntityApiCtx,
} from '../../../src/index.js';
import { Order } from '../entities.js';

const orderApi = defineEntityApi(Order, {
  idSchema: z.coerce.number().int(),
  listQuery: z.object({ status: z.string().optional() }),
  fields: {
    id: { readOnly: true },
    user_id: {},
    total: {},
    status: {},
    user: { relation: true },
  },
  include: { allowed: ['user'], maxDepth: 1 },
});
const orderFields = orderApi.fields;

const orderReportResponse = named(
  'OrderReportResponse',
  z.array(
    z.object({
      status: z.string(),
      total: z.number(),
    })
  )
);

@Controller('/orders')
export class MetalOrmOrdersController {
  constructor(private readonly session: OrmSession) {}

  @Get('/', {
    query: orderApi.refs.list.query,
    response: orderApi.refs.list.response,
    includePolicy: orderApi.includePolicy,
  })
  async list(ctx: EntityApiCtx<typeof orderApi.refs, 'list'>) {
    const ref = entityRef(Order) as any;
    let qb = selectFromEntity(Order);
    if (ctx.input.query.status) {
      qb = qb.where(eq(ref.status, ctx.input.query.status));
    }
    for (const rel of ctx.input.include.tokens) {
      qb = qb.include(rel as any);
    }
    const items = await qb.execute(this.session);
    return extractEntityDtos(items, orderFields);
  }

  @Get('/{id}', {
    params: orderApi.refs.get.params,
    query: orderApi.refs.get.query,
    response: orderApi.refs.get.response,
    includePolicy: orderApi.includePolicy,
  })
  async get(ctx: EntityApiCtx<typeof orderApi.refs, 'get'>) {
    const ref = entityRef(Order) as any;
    let qb = selectFromEntity(Order).where(eq(ref.id, ctx.input.params.id)).limit(1);
    for (const rel of ctx.input.include.tokens) {
      qb = qb.include(rel as any);
    }
    const [item] = await qb.execute(this.session);
    if (!item) throw new NotFoundError('Order not found');
    return extractEntityDtos(item, orderFields);
  }

  @Post('/', {
    query: orderApi.refs.list.query,
    body: orderApi.refs.create.body,
    response: orderApi.refs.create.response,
  })
  async create(ctx: EntityApiCtx<typeof orderApi.refs, 'create'>) {
    const data = { ...(ctx.input.body as Record<string, unknown>), id: await this.nextId() };
    await this.executeDml(insertInto(orderFields.table).values(data));
    const entity = await this.getEntity(data.id as number);
    return extractEntityDtos(entity, orderFields);
  }

  @Put('/{id}', {
    params: orderApi.refs.update.params,
    query: orderApi.refs.list.query,
    body: orderApi.refs.update.body,
    response: orderApi.refs.update.response,
  })
  async replace(ctx: EntityApiCtx<typeof orderApi.refs, 'update'>) {
    await this.getEntity(ctx.input.params.id);
    const ref = tableRef(orderFields.table) as any;
    await this.executeDml(
      update(orderFields.table)
      .set(ctx.input.body as Record<string, unknown>)
      .where(eq(ref.id, ctx.input.params.id))
    );
    const entity = await this.getEntity(ctx.input.params.id);
    return extractEntityDtos(entity, orderFields);
  }

  @Patch('/{id}', {
    params: orderApi.refs.update.params,
    query: orderApi.refs.list.query,
    body: orderApi.refs.update.body,
    response: orderApi.refs.update.response,
  })
  async update(ctx: EntityApiCtx<typeof orderApi.refs, 'update'>) {
    await this.getEntity(ctx.input.params.id);
    const ref = tableRef(orderFields.table) as any;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(ctx.input.body as Record<string, unknown>)) {
      if (value !== undefined) updates[key] = value;
    }
    await this.executeDml(
      update(orderFields.table)
      .set(updates)
      .where(eq(ref.id, ctx.input.params.id))
    );
    const entity = await this.getEntity(ctx.input.params.id);
    return extractEntityDtos(entity, orderFields);
  }

  @Delete('/{id}', {
    params: orderApi.refs.remove.params,
    query: EmptyQuery,
    response: EmptyResponse,
  })
  async remove(ctx: EntityApiCtx<typeof orderApi.refs, 'remove'>) {
    await this.getEntity(ctx.input.params.id);
    const ref = tableRef(orderFields.table) as any;
    await this.executeDml(
      deleteFrom(orderFields.table)
      .where(eq(ref.id, ctx.input.params.id))
    );
    return undefined;
  }

  @Post('/{id}/cancel', {
    params: orderApi.refs.get.params,
    query: orderApi.refs.get.query,
    body: EmptyBody,
    response: orderApi.refs.get.response,
  })
  async cancel(ctx: EntityApiCtx<typeof orderApi.refs, 'get'>) {
    await this.getEntity(ctx.input.params.id);
    const ref = tableRef(orderFields.table) as any;
    await this.executeDml(
      update(orderFields.table)
      .set({ status: 'cancelled' })
      .where(eq(ref.id, ctx.input.params.id))
    );
    const entity = await this.getEntity(ctx.input.params.id);
    return extractEntityDtos(entity, orderFields);
  }

  private async getEntity(id: number) {
    const ref = entityRef(Order) as any;
    const [row] = await selectFromEntity(Order)
      .where(eq(ref.id, id))
      .limit(1)
      .executePlain(this.session);
    if (!row) throw new NotFoundError('Order not found');
    return row;
  }

  private async nextId(): Promise<number> {
    const ref = entityRef(Order) as any;
    const rows = (await selectFromEntity(Order)
      .select({ maxId: max(ref.id) })
      .executePlain(this.session)) as Array<{ maxId?: number }>;
    const raw = rows[0]?.maxId;
    const maxId =
      typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0;
    return maxId + 1;
  }

  private async executeDml(builder: { compile: (dialect: any) => { sql: string; params?: unknown[] } }) {
    const compiled = builder.compile(this.session.dialect);
    await this.session.executor.executeSql(compiled.sql, compiled.params ?? []);
  }
}

@Controller('/reports')
export class MetalOrmReportsController {
  constructor(private readonly session: OrmSession) {}

  @Get('/orders', {
    query: EmptyQuery,
    response: orderReportResponse,
  })
  async ordersReport() {
    const table = getTableDefFromEntity(Order);
    if (!table) return [];
    const ref = tableRef(table) as any;
    const builder = selectFrom(table)
      .select({ status: ref.status, total: count(ref.id) })
      .groupBy(ref.status);
    const compiled = builder.compile(this.session.dialect);
    const results = await this.session.executor.executeSql(
      compiled.sql,
      compiled.params ?? []
    );
    return results.flatMap(({ columns, values }) =>
      values.map((row) => {
        const out: Record<string, unknown> = {};
        columns.forEach((col, idx) => {
          out[col] = row[idx];
        });
        if (typeof out.total === 'string') {
          const asNumber = Number(out.total);
          if (Number.isFinite(asNumber)) out.total = asNumber;
        }
        return out;
      })
    );
  }
}
