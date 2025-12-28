import type { Schema } from '../validation/native/schema.js';

type InferSchema<S> = S extends Schema<infer T> ? T : never;

export type QueryOf<R> =
  R extends { options: { validate?: { query?: infer S } } } ? InferSchema<S> : never;

export type BodyOf<R> =
  R extends { options: { validate?: { body?: infer S } } } ? InferSchema<S> : never;

export type ParamsOf<R> =
  R extends { options: { validate?: { params?: infer S } } } ? InferSchema<S> : never;
