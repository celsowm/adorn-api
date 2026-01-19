import type { CreateSessionFn } from "./types";
import { HttpError } from "../../core/errors";
import { coerce } from "../../core/coerce";

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
