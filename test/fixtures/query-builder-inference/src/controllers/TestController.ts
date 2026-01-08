import { Controller, Get } from "adorn-api";

// Real types for schema generation test
class TestEntity {
  id!: number;
  title!: string;
  content!: string;
  status!: string;
  author!: { id: number; name: string };
  category!: { id: number; name: string };
}

interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
}

// Mock query builder for schema generation test
declare const selectFromEntity: any;
// Mock session for schema generation test
const session: any = {};

@Controller("/test-query-builder")
export class TestQueryBuilderController {

  /**
   * Simple select with pagination
   * Should generate minimal schema with only selected fields: id, title, status
   * @example GET /test-query-builder/simple
   */
  @Get("/simple")
  async getSimple(): Promise<PaginatedResult<TestEntity>> {
    return selectFromEntity(TestEntity)
      .select("id", "title", "status")
      .executePaged(session, { page: 1, pageSize: 10 });
  }

  /**
   * Select with include
   * Should include relation fields
   * @example GET /test-query-builder/with-include
   */
  @Get("/with-include")
  async getWithInclude(): Promise<PaginatedResult<TestEntity>> {
    return selectFromEntity(TestEntity)
      .select("id", "title", "author")
      .include({
        author: true
      })
      .executePaged(session, { page: 1, pageSize: 10 });
  }

  /**
   * Complex nested include
   * Should handle nested relations
   * @example GET /test-query-builder/nested-include
   */
  @Get("/nested-include")
  async getNestedInclude(): Promise<PaginatedResult<TestEntity>> {
    return selectFromEntity(TestEntity)
      .select("id", "title", "author", "category")
      .include({
        author: true,
        category: {
          select: ["id", "name"]
        }
      })
      .executePaged(session, { page: 1, pageSize: 10 });
  }

  /**
   * Variable reassignment pattern
   * Should detect variable reassignments and accumulate state
   * @example GET /test-query-builder/variable-reassignment
   */
  @Get("/variable-reassignment")
  async getWithVariableReassignment(): Promise<PaginatedResult<TestEntity>> {
    let qb = selectFromEntity(TestEntity);
    qb = qb.select("id", "title", "status");
    qb = qb.include({ author: true });
    return qb.executePaged(session, { page: 1, pageSize: 10 });
  }
}