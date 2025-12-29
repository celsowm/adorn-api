# MetalORM integration

The repository demonstrates how to wire MetalORM into controller-based handlers using the `adorn-api/metal-orm` package.

## Schema Helpers

The `adorn-api/metal-orm` package exposes helpers to derive validation and filter schemas from decorated entity metadata:

- `entityDto` - Creates DTO types from entity definitions
- `filtersFromEntity` - Generates filter schemas from entity properties  
- `tableDefOf` - Extracts table definitions from entities

## Database Integration

Controllers can persist entities using `OrmSession` with SQLite or other databases:

```typescript
import { Controller, Get, Post } from '@adorn/api';
import { entityDto, filtersFromEntity } from '@adorn/api/metal-orm';
import { createSqliteExecutor } from 'metal-orm';

@Controller('/users')
class UsersController {
  @Get('/')
  async listUsers() {
    const users = await this.ormSession.selectFrom(User).execute();
    return reply(200, users);
  }
  
  @Post('/')
  async createUser(userData: CreateUserDto) {
    const user = new User(userData);
    await this.ormSession.persist(user);
    await this.ormSession.commit();
    return reply(201, user);
  }
}
```

## Session Management

The ORM session provides:
- `persist(entity)` - Track entities for saving
- `commit()` - Persist all tracked changes
- `markDirty(entity)` - Mark entities as modified
- `markRemoved(entity)` - Mark entities for deletion

## Query Building

Use the ORM's query builder with the generated filters:

```typescript
import { filtersFromEntity } from '@adorn/api/metal-orm';

const userFilters = filtersFromEntity(User);
const users = await this.ormSession
  .selectFrom(User)
  .where(userFilters.name.eq('Alice'))
  .execute();
```

## Testing with In-Memory SQLite

For testing, use the in-memory SQLite executor:

```typescript
import { createSqliteExecutor } from 'metal-orm';

const executor = createSqliteExecutor(':memory:');
const ormContext = {
  db: executor,
  orm: createOrm(executor),
  executor: executor,
};
```

The ORM handles transactions, flush hooks, and relation tracking automatically, so controllers only need to `persist`, mutate tracked entities, and `commit`.
