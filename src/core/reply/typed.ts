import type { ResponsesSpec } from '../../contracts/responses.js';
import type { Reply, ReplyHeaderValue } from '../../contracts/reply.js';
import type { Schema, Infer } from '../../validation/native/schema.js';
import type { ReplyInit } from './reply.js';
import { reply as baseReply, noContent as baseNoContent } from './reply.js';
import type {
  AllowedStatus,
  BodySchemaFor,
  HeadersDefFor,
  StatusesNoBody,
  StatusesWithBody,
} from '../../contracts/response-types.js';

type HeaderValueFromSpec<H> =
  H extends { schema: infer S extends Schema<any> }
    ? (Exclude<Infer<S>, undefined> extends ReplyHeaderValue ? Exclude<Infer<S>, undefined> : ReplyHeaderValue)
    : ReplyHeaderValue;

type HeaderValues<H> =
  H extends Record<string, any>
    ? string extends keyof H
      ? Record<string, HeaderValueFromSpec<H[string]>>
      : { [K in keyof H]?: HeaderValueFromSpec<H[K]> }
    : never;

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
