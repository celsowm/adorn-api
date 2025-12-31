const ADORN_META = Symbol.for("adorn-api.metadata");

interface SchemaFrag {
  [key: string]: unknown;
}

interface SchemaMetadata {
  schema: {
    props: Record<string, SchemaFrag[]>;
  };
}

function getOrCreateMetadata(metadata: Record<PropertyKey, unknown>): SchemaMetadata {
  const meta = (metadata[ADORN_META] ??= {}) as SchemaMetadata;
  meta.schema ??= { props: {} };
  return meta;
}

function pushSchemaFrag(
  target: Object,
  propertyKey: string | symbol,
  metadata: Record<PropertyKey, unknown>,
  frag: SchemaFrag
): void {
  const meta = getOrCreateMetadata(metadata);
  const props = meta.schema.props;
  (props[propertyKey as string] ??= []).push(frag);
}

type PropertyDecorator = (target: Object, propertyKey: string | symbol, descriptor?: PropertyDescriptor) => void;

export function Schema(frag: SchemaFrag): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, frag);
  };
}

export function Min(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { minimum: n });
  };
}

export function Max(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { maximum: n });
  };
}

export function ExclusiveMin(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { exclusiveMinimum: n });
  };
}

export function ExclusiveMax(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { exclusiveMaximum: n });
  };
}

export function MinLength(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { minLength: n });
  };
}

export function MaxLength(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { maxLength: n });
  };
}

export function Pattern(re: RegExp | string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { pattern: typeof re === "string" ? re : re.source });
  };
}

export function Format(fmt: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { format: fmt });
  };
}

export function MinItems(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { minItems: n });
  };
}

export function MaxItems(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { maxItems: n });
  };
}

export function MinProperties(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { minProperties: n });
  };
}

export function MaxProperties(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { maxProperties: n });
  };
}

export function MultipleOf(n: number): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { multipleOf: n });
  };
}

export function Example(value: unknown): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { example: value });
  };
}

export function Examples(values: unknown[]): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { examples: values });
  };
}

export function Description(desc: string): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { description: desc });
  };
}

export function Enum<T extends string | number>(vals: T[]): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { enum: vals });
  };
}

export function Const<T>(val: T): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    pushSchemaFrag(target, propertyKey, {}, { const: val });
  };
}

export { ADORN_META };
export type { SchemaFrag, SchemaMetadata };
