import type { ResponsesSpec, ResponseSpec } from '../../contracts/responses';
import type { Reply } from '../../contracts/reply';
import type { Schema } from '../../validation/native/schema';
import type { Infer } from '../../validation/native/schema';
import type { ReplyInit } from './reply';
import { reply as baseReply, noContent as baseNoContent } from './reply';

type StatusKey<R> = Extract<keyof R, `${number}`>;
type StatusNum<K> = K extends `${infer N extends number}` ? N : never;

type AllowedStatus<R extends ResponsesSpec> =
  StatusNum<StatusKey<R>> | (R extends { default: any } ? number : never);

type ResAt<R extends ResponsesSpec, S extends number> =
  `${S}` extends keyof R ? R[`${S}`] :
  R extends { default: infer D } ? D :
  never;

type NormalizeRes<X> =
  X extends Schema<any> ? { content: { 'application/json': { schema: X } } } :
  X extends ResponseSpec ? X :
  never;

type ContentOf<X> = NormalizeRes<X> extends { content: infer C } ? C : never;

type SchemaFromContent<C> =
  C extends Record<PropertyKey, any>
    ? ('application/json' extends keyof C
        ? C['application/json'] extends { schema: infer S extends Schema<any> } ? S : never
        : C[keyof C] extends { schema: infer S extends Schema<any> } ? S : never)
    : never;

type BodySchemaFor<R extends ResponsesSpec, S extends number> =
  SchemaFromContent<ContentOf<ResAt<R, S>>>;

type HeadersDefFor<R extends ResponsesSpec, S extends number> =
  NormalizeRes<ResAt<R, S>> extends { headers?: infer H } ? H : undefined;

type HeaderValues<H> =
  H extends Record<string, any>
    ? { [K in keyof H]?: H[K] extends { schema: infer S extends Schema<any> } ? Infer<S> : string }
    : undefined;

type InitFor<R extends ResponsesSpec, S extends number> =
  Omit<ReplyInit, 'headers'> & { headers?: HeaderValues<HeadersDefFor<R, S>> };

type StatusesWithBody<R extends ResponsesSpec> =
  { [K in StatusKey<R>]: BodySchemaFor<R, StatusNum<K>> extends never ? never : StatusNum<K> }[StatusKey<R>];

type StatusesNoBody<R extends ResponsesSpec> =
  { [K in StatusKey<R>]: BodySchemaFor<R, StatusNum<K>> extends never ? StatusNum<K> : never }[StatusKey<R>];

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
