import { optional, v } from '../../../validation/native/schema.js';
import type { Schema } from '../../../validation/native/schema.js';
import { columnToSchema } from './column-map.js';
import { tableDefOf, type EntityCtor } from './tabledef.js';
import type { ColumnDef } from 'metal-orm';

/**
 * Options for customizing entity schema generation.
 *
 * These options allow selecting specific columns, excluding columns,
 * and naming the generated schema.
 */
export type EntitySchemaOptions = {
  /** Array of column names to include (exclusive selection) */
  pick?: readonly string[];
  /** Array of column names to exclude */
  omit?: readonly string[];
  /** Optional name for the generated schema */
  name?: string;
};

/**
 * Generates a validation schema from a Metal-ORM entity.
 *
 * This function creates a Schema object that validates data against
 * the structure of a Metal-ORM entity, including column types,
 * nullability constraints, and other database-level validations.
 *
 * @template T - The entity type
 * @param Entity - Metal-ORM entity constructor
 * @param opts - Options for customizing schema generation
 * @returns Schema that validates against the entity structure
 *
 * @example
 * ```typescript
 * // Basic entity schema
 * const userSchema = entity(User);
 *
 * // Schema with selected columns only
 * const userProfileSchema = entity(User, {
 *   pick: ['id', 'name', 'email', 'avatarUrl']
 * });
 *
 * // Schema with excluded columns
 * const userPublicSchema = entity(User, {
 *   omit: ['passwordHash', 'emailVerificationToken']
 * });
 *
 * // Named schema
 * const createUserSchema = entity(User, {
 *   name: 'CreateUserDto',
 *   omit: ['id', 'createdAt', 'updatedAt']
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Using in a controller with validation
 * @Post('/users')
 * async createUser(@Body() userData: unknown) {
 *   const userSchema = entity(User, {
 *     omit: ['id', 'createdAt', 'updatedAt']
 *   });
 *
 *   const validationResult = await validator.validate(userData, userSchema);
 *   if (!validationResult.ok) {
 *     throw ValidationError.fromIssues(validationResult.issues);
 *   }
 *
 *   const createdUser = await userService.create(validationResult.value);
 *   return reply(201, createdUser);
 * }
 * ```
 *
 * @see Schema for the returned schema type
 * @see EntityCtor for Metal-ORM entity constructor type
 */
export function entity<T>(Entity: EntityCtor<T>, opts: EntitySchemaOptions = {}): Schema<T> {
  const table = tableDefOf(Entity);
  const pick = opts.pick ? new Set(opts.pick) : null;
  const omit = opts.omit ? new Set(opts.omit) : null;

  const shape: Record<string, Schema<any>> = {};

  for (const [key, column] of Object.entries(table.columns) as [string, ColumnDef][]) {
    if (pick && !pick.has(key)) continue;
    if (omit && omit.has(key)) continue;

    const schema = columnToSchema(column);
    shape[key] = column.notNull ? schema : optional(schema);
  }

  const base = v.object(shape).strict();
  const typed = base as unknown as Schema<T>;
  return opts.name ? v.named(opts.name, typed) : typed;
}

/**
 * Namespace for entity-related schema utilities.
 */
export namespace entity {
  /**
   * Generates a validation schema for an array of entities.
   *
   * @template T - The entity type
   * @param Entity - Metal-ORM entity constructor
   * @param opts - Options for customizing schema generation
   * @returns Schema that validates an array of entities
   *
   * @example
   * ```typescript
   * // Array of users
   * const usersArraySchema = entity.array(User);
   *
   * // Array with selected columns
   * const userPreviewsSchema = entity.array(User, {
   *   pick: ['id', 'name', 'email']
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Using in a controller
   * @Post('/users/bulk')
   * async createUsers(@Body() usersData: unknown[]) {
   *   const usersSchema = entity.array(User, {
   *     omit: ['id', 'createdAt', 'updatedAt']
   *   });
   *
   *   const validationResult = await validator.validate(usersData, usersSchema);
   *   if (!validationResult.ok) {
   *     throw ValidationError.fromIssues(validationResult.issues);
   *   }
   *
   *   const createdUsers = await userService.bulkCreate(validationResult.value);
   *   return reply(201, createdUsers);
   * }
   * ```
   */
  export function array<T>(Entity: EntityCtor<T>, opts: EntitySchemaOptions = {}) {
    return v.array(entity(Entity, opts));
  }
}
