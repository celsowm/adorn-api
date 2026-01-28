import type { CreateSessionFn } from "./types";
import { HttpError } from "../../core/errors";
import { coerce } from "../../core/coerce";

/**
 * Removes undefined values from an object, returning a partial type.
 * Useful for patch updates where only changed fields should be applied.
 * @param updates - Object with potentially undefined values
 * @returns Object with only defined values
 */
export function compactUpdates<T extends Record<string, unknown>>(
  updates: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

/**
 * Applies input data to an entity, optionally filtering out undefined values.
 * @param entity - Entity to apply data to
 * @param input - Input data to apply
 * @param options - Options for applying input
 * @param options.partial - Whether to filter out undefined values (for PATCH updates)
 */
export function applyInput<T extends object>(
  entity: T,
  input: Partial<T>,
  options: { partial: boolean } = { partial: false }
): void {
  const payload = options.partial ? compactUpdates(input) : input;
  Object.assign(entity, payload);
}

/**
 * Gets an entity by ID or throws a 404 error if not found.
 * @param session - ORM session
 * @param target - Entity class
 * @param id - Entity ID
 * @param entityName - Name for error messages
 * @returns The entity
 * @throws HttpError 404 if entity not found
 */
export async function getEntityOrThrow<T extends { id: number }>(
  session: any,
  target: any,
  id: number,
  entityName: string
): Promise<T> {
  const entity = await session.find(target, id);
  if (!entity) {
    throw new HttpError(404, `${entityName} not found.`);
  }
  return entity;
}

/**
 * Executes a handler function with an ORM session.
 * @param createSession - Function to create a session
 * @param handler - Function to execute with the session
 * @returns Result from the handler function
 */
export async function withSession<T>(
  createSession: CreateSessionFn,
  handler: (session: any) => Promise<T>
): Promise<T> {
  const session = createSession();
  try {
    return await handler(session);
  } finally {
    await session.dispose();
  }
}

/**
 * Parses an ID value and throws an error if invalid.
 * @param value - ID value to parse
 * @param entityName - Name of the entity for error messages
 * @returns Parsed ID
 * @throws HttpError if the ID is invalid
 */
export function parseIdOrThrow(value: string | number, entityName: string): number {
  const id = coerce.id(value);
  if (id === undefined) {
    throw new HttpError(400, `Invalid ${entityName} id.`);
  }
  return id;
}
