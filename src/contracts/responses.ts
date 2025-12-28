import type { Schema } from '../validation/native/schema';

export type ResponseContentSpec = {
  schema: Schema<any>;
  example?: unknown;
};

export type HeaderSpec = {
  schema: Schema<any>;
  description?: string;
  required?: boolean;
};

export type ResponseSpec = {
  description?: string;
  headers?: Record<string, HeaderSpec>;
  content?: Record<string, ResponseContentSpec>;
  schema?: Schema<any>;
};

export type ResponsesSpec = Record<string, ResponseSpec | Schema<any>>;
