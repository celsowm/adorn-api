import type { ResponsesSpec } from '../../contracts/responses';
import type { Reply } from '../../contracts/reply';
import type { Schema, Infer } from '../../validation/native/schema';
import type { ReplyInit } from './reply';
import { reply as baseReply, noContent as baseNoContent } from './reply';
import type {
  AllowedStatus,
  BodySchemaFor,
  HeadersDefFor,
  StatusesNoBody,
  StatusesWithBody,
} from '../../contracts/response-types';

type HeaderValues<H> =
  H extends Record<string, any>
    ? { [K in keyof H]?: H[K] extends { schema: infer S extends Schema<any> } ? Infer<S> : string }
    : undefined;

type InitFor<R extends ResponsesSpec, S extends number> =
  Omit<ReplyInit, 'headers'> & { headers?: HeaderValues<HeadersDefFor<R, S>> };

export function makeReply<const R extends ResponsesSpec>(_responses: R) {
  return {
    /**
     * Only allowed for statuses that have a body schema in `responses`.
     * Body is type-checked against that schema.
     */
    reply<const S extends AllowedStatus<R> & StatusesWithBody<R>>(
      status: S,
      body: Infer<BodySchemaFor<R, S>>,
      init?: InitFor<R, S>,
    ): Reply<Infer<BodySchemaFor<R, S>>, S> {
      return baseReply(status, body, init);
    },

    /**
     * For no-content responses (204 etc) or when you want an empty body.
     */
    noContent<const S extends AllowedStatus<R> & (StatusesNoBody<R> | number)>(
      status?: S,
      init?: InitFor<R, S>,
    ): Reply<undefined, S> {
      return baseNoContent(status as any, init as any) as any;
    },
  };
}
