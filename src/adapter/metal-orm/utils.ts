import type { CreateSessionFn } from "./types";
import { HttpError } from "../../core/errors";
import { coerce } from "../../core/coerce";

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

export function parseIdOrThrow(value: string | number, entityName: string): number {
  const id = coerce.id(value);
  if (id === undefined) {
    throw new HttpError(400, `Invalid ${entityName} id.`);
  }
  return id;
}
