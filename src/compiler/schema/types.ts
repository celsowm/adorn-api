/**
 * JSON Schema type definitions for the compiler.
 * Core types used throughout schema generation.
 */
import ts from "typescript";

/**
 * JSON Schema representation used throughout the compiler.
 * Extended with OpenAPI and vendor-specific properties.
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number | boolean)[];
  $ref?: string;
  nullable?: boolean;
  description?: string;
  default?: unknown;
  examples?: unknown[];
  example?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  discriminator?: DiscriminatorObject;
  additionalProperties?: boolean | JsonSchema;
  unevaluatedProperties?: boolean | JsonSchema;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  multipleOf?: number;
  const?: unknown;
  uniqueItems?: boolean;
  title?: string;
  readOnly?: boolean;
  "x-metal-orm-entity"?: string;
  "x-metal-orm-mode"?: string;
  "x-metal-orm-rel"?: Record<string, unknown>;
  "x-ts-type"?: string;
}

/**
 * OpenAPI discriminator object for polymorphism support.
 */
export interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
}

/**
 * Context object passed through schema generation functions.
 * Provides access to type checker, component registry, and generation options.
 */
export interface SchemaContext {
  checker: ts.TypeChecker;
  components: Map<string, JsonSchema>;
  typeStack: Set<ts.Type>;
  typeNameStack: string[];
  mode?: "request" | "response";
  propertyName?: string;
  typeParameterSubstitutions?: Map<string, ts.Type>;
}
