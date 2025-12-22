// src/lib/common.ts
import { FromQuery } from "./decorators.js";

// --- 1. Generic Response Wrappers ---

// Helper to clean up intersection types in tooltips/logs
export type Jsonify<T> = { [K in keyof T]: T[K] } & {};

export type EntityResponse<TEntity> = Jsonify<TEntity>;

// --- 2. Pagination Logic ---

// We need a Concrete Class for Pagination because it carries Metadata (@FromQuery)
export class PaginationQuery {
  @FromQuery()
  page: number = 1;

  @FromQuery()
  limit: number = 20;
}

// The generic type for list queries
export type ListQuery<TFilters extends object = object> = PaginationQuery & TFilters;

// --- 3. CRUD Input Helpers ---
// Note: You cannot "extend" these Mapped Types in a class directly in TS.
// These are best used for Type Checking interfaces or Return Types.

export type CreateInput<
  TEntityJson extends object,
  TRequiredKeys extends keyof TEntityJson,
  TOptionalKeys extends keyof TEntityJson = never,
> = Pick<TEntityJson, TRequiredKeys> & Partial<Pick<TEntityJson, TOptionalKeys>>;

export type UpdateInput<TCreateInput> = Partial<TCreateInput>;
