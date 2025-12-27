import {
  entityRef,
  eq,
  getTableDefFromEntity,
  selectFromEntity,
  tableRef,
  update,
  type OrmSession,
} from 'metal-orm';
import { z } from 'zod';
import {
  Controller,
  Get,
  NotFoundError,
  Post,
  defineEntityApi,
  extractEntityDtos,
  EmptyBody,
  type EntityApiCtx,
} from '../../../src/index.js';
import { User } from '../entities.js';

export const userApi = defineEntityApi(User, {
  idSchema: z.coerce.number().int(),
  fields: {
    id: { readOnly: true },
    name: {},
    email: {},
    active: {},
    posts: { relation: true },
  },
  include: { allowed: ['posts'], maxDepth: 1 },
});
const userFields = userApi.fields;

@Controller('/users')
export class MetalOrmEntityController {
  constructor(private readonly session: OrmSession) {}

  @Get('/', {
    query: userApi.refs.list.query,
    response: userApi.refs.list.response,
    includePolicy: userApi.includePolicy,
  })
  async list(ctx: EntityApiCtx<typeof userApi.refs, 'list'>) {
    let qb = selectFromEntity(User);
    for (const rel of ctx.input.include.tokens) {
      qb = qb.include(rel as any);
    }
    const items = await qb.execute(this.session);
    return extractEntityDtos(items, userFields);
  }

  @Get('/{id}', {
    params: userApi.refs.get.params,
    query: userApi.refs.get.query,
    response: userApi.refs.get.response,
    includePolicy: userApi.includePolicy,
  })
  async get(ctx: EntityApiCtx<typeof userApi.refs, 'get'>) {
    const ref = entityRef(User) as any;
    let qb = selectFromEntity(User).where(eq(ref.id, ctx.input.params.id)).limit(1);
    for (const rel of ctx.input.include.tokens) {
      qb = qb.include(rel as any);
    }
    const [item] = await qb.execute(this.session);
    if (!item) throw new NotFoundError('User not found');
    return extractEntityDtos(item, userFields);
  }

  @Post('/{id}/activate', {
    params: userApi.refs.get.params,
    query: userApi.refs.get.query,
    body: EmptyBody,
    response: userApi.refs.get.response,
  })
  async activate(ctx: EntityApiCtx<typeof userApi.refs, 'get'>) {
    const ref = entityRef(User) as any;
    const [item] = await selectFromEntity(User)
      .where(eq(ref.id, ctx.input.params.id))
      .limit(1)
      .executePlain(this.session);
    if (!item) throw new NotFoundError('User not found');
    const table = getTableDefFromEntity(User);
    if (table) {
      const tableRefs = tableRef(table) as any;
      await update(table)
        .set({ active: true })
        .where(eq(tableRefs.id, ctx.input.params.id))
        .execute(this.session);
    }
    const [updated] = await selectFromEntity(User)
      .where(eq(ref.id, ctx.input.params.id))
      .limit(1)
      .executePlain(this.session);
    if (!updated) throw new NotFoundError('User not found');
    return extractEntityDtos(updated, userFields);
  }
}
