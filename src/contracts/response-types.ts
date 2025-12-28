import type { Schema } from '../validation/native/schema';
import type { ResponseSpec, ResponsesSpec } from './responses';

export type StatusKey<R extends ResponsesSpec> = Extract<keyof R, `${number}`>;
export type StatusNum<K extends string> = K extends `${infer N extends number}` ? N : never;

export type AllowedStatus<R extends ResponsesSpec> =
  StatusNum<StatusKey<R>> | (R extends { default: any } ? number : never);

export type ResAt<R extends ResponsesSpec, S extends number> =
  `${S}` extends keyof R ? R[`${S}`] :
  R extends { default: infer D } ? D :
  never;

export type NormalizeRes<X> =
  X extends Schema<any> ? { content: { 'application/json': { schema: X } } } :
  X extends ResponseSpec ? X :
  never;

export type ContentOf<X> = NormalizeRes<X> extends { content: infer C } ? C : never;

export type SchemaFromContent<C> =
  C extends Record<PropertyKey, any>
    ? ('application/json' extends keyof C
        ? C['application/json'] extends { schema: infer S extends Schema<any> } ? S : never
        : C[keyof C] extends { schema: infer S extends Schema<any> } ? S : never)
    : never;

export type BodySchemaFor<R extends ResponsesSpec, S extends number> =
  SchemaFromContent<ContentOf<ResAt<R, S>>>;

export type HeadersDefFor<R extends ResponsesSpec, S extends number> =
  NormalizeRes<ResAt<R, S>> extends { headers?: infer H } ? H : undefined;

export type StatusesWithBody<R extends ResponsesSpec> =
  { [K in StatusKey<R>]: BodySchemaFor<R, StatusNum<K>> extends never ? never : StatusNum<K> }[StatusKey<R>];

export type StatusesNoBody<R extends ResponsesSpec> =
  { [K in StatusKey<R>]: BodySchemaFor<R, StatusNum<K>> extends never ? StatusNum<K> : never }[StatusKey<R>];

export type SuccessStatusKeys<R extends ResponsesSpec> = Extract<StatusKey<R>, `2${string}`>;
export type SuccessStatusNumbers<R extends ResponsesSpec> =
  SuccessStatusKeys<R> extends `${infer N extends number}` ? N : never;

export type SuccessStatusesWithBody<R extends ResponsesSpec> =
  Extract<StatusesWithBody<R>, SuccessStatusNumbers<R>>;

export type SuccessStatusesNoBody<R extends ResponsesSpec> =
  Extract<StatusesNoBody<R>, SuccessStatusNumbers<R>>;
