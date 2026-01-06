import ts from "typescript";

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

export interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface SchemaContext {
  checker: ts.TypeChecker;
  components: Map<string, JsonSchema>;
  typeStack: Set<ts.Type>;
  typeNameStack: string[];
  mode?: "request" | "response";
  propertyName?: string;
}
