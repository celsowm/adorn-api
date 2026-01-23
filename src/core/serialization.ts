/**
 * Serialization decorators and utilities for controlling JSON output.
 */

/**
 * Serialization groups for conditional field inclusion.
 */
export type SerializationGroup = string;

/**
 * Transform function signature.
 */
export type TransformFn<T = unknown, R = unknown> = (value: T, obj: unknown) => R;

/**
 * Options for the @Exclude decorator.
 */
export interface ExcludeOptions {
  /** Only exclude when serializing to these groups */
  groups?: SerializationGroup[];
}

/**
 * Options for the @Expose decorator.
 */
export interface ExposeOptions {
  /** Custom name for the serialized property */
  name?: string;
  /** Only expose when serializing to these groups */
  groups?: SerializationGroup[];
}

/**
 * Options for the @Transform decorator.
 */
export interface TransformOptions {
  /** Only transform when serializing to these groups */
  groups?: SerializationGroup[];
}

/**
 * Options for serialization.
 */
export interface SerializeOptions {
  /** Serialization groups to apply */
  groups?: SerializationGroup[];
  /** Exclude all properties by default (require @Expose) */
  excludeAll?: boolean;
}

/**
 * Metadata for a serializable field.
 */
interface FieldSerializationMeta {
  exclude?: ExcludeOptions;
  expose?: ExposeOptions;
  transforms?: Array<{ fn: TransformFn; options?: TransformOptions }>;
}

/**
 * Metadata for a serializable class.
 */
interface ClassSerializationMeta {
  fields: Map<string, FieldSerializationMeta>;
}

const serializationStore = new WeakMap<object, ClassSerializationMeta>();

function getClassMeta(prototype: object): ClassSerializationMeta {
  let meta = serializationStore.get(prototype);
  if (!meta) {
    meta = { fields: new Map() };
    serializationStore.set(prototype, meta);
  }
  return meta;
}

function getFieldMeta(prototype: object, key: string): FieldSerializationMeta {
  const classMeta = getClassMeta(prototype);
  let fieldMeta = classMeta.fields.get(key);
  if (!fieldMeta) {
    fieldMeta = {};
    classMeta.fields.set(key, fieldMeta);
  }
  return fieldMeta;
}

/**
 * Decorator to exclude a field from serialization.
 * @param options - Exclude options
 * @returns Property decorator function
 */
export function Exclude(options: ExcludeOptions = {}) {
  return function (_value: unknown, context: ClassFieldDecoratorContext): void {
    if (typeof context.name !== "string") {
      throw new Error("Exclude decorator only supports string property keys.");
    }
    context.addInitializer(function () {
      const fieldMeta = getFieldMeta(Object.getPrototypeOf(this), context.name as string);
      fieldMeta.exclude = options;
    });
  };
}

/**
 * Decorator to expose a field for serialization (used with excludeAll option).
 * @param options - Expose options
 * @returns Property decorator function
 */
export function Expose(options: ExposeOptions = {}) {
  return function (_value: unknown, context: ClassFieldDecoratorContext): void {
    if (typeof context.name !== "string") {
      throw new Error("Expose decorator only supports string property keys.");
    }
    context.addInitializer(function () {
      const fieldMeta = getFieldMeta(Object.getPrototypeOf(this), context.name as string);
      fieldMeta.expose = options;
    });
  };
}

/**
 * Decorator to transform a field value during serialization.
 * @param fn - Transform function
 * @param options - Transform options
 * @returns Property decorator function
 */
export function Transform<T = unknown, R = unknown>(
  fn: TransformFn<T, R>,
  options: TransformOptions = {}
) {
  return function (_value: unknown, context: ClassFieldDecoratorContext): void {
    if (typeof context.name !== "string") {
      throw new Error("Transform decorator only supports string property keys.");
    }
    context.addInitializer(function () {
      const fieldMeta = getFieldMeta(Object.getPrototypeOf(this), context.name as string);
      if (!fieldMeta.transforms) {
        fieldMeta.transforms = [];
      }
      fieldMeta.transforms.push({ fn: fn as TransformFn, options });
    });
  };
}

/**
 * Checks if groups match for serialization.
 */
function groupsMatch(
  fieldGroups: SerializationGroup[] | undefined,
  activeGroups: SerializationGroup[] | undefined
): boolean {
  if (!fieldGroups || fieldGroups.length === 0) {
    return true;
  }
  if (!activeGroups || activeGroups.length === 0) {
    return false;
  }
  return fieldGroups.some((g) => activeGroups.includes(g));
}

/**
 * Serializes an object applying @Exclude, @Expose, and @Transform decorators.
 * @param obj - Object to serialize
 * @param options - Serialization options
 * @returns Serialized plain object
 */
export function serialize<T extends object>(
  obj: T,
  options: SerializeOptions = {}
): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return obj as unknown as Record<string, unknown>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => 
      typeof item === "object" && item !== null ? serialize(item, options) : item
    ) as unknown as Record<string, unknown>;
  }

  const prototype = Object.getPrototypeOf(obj);
  const classMeta = serializationStore.get(prototype);
  const result: Record<string, unknown> = {};
  const activeGroups = options.groups;
  const excludeAll = options.excludeAll ?? false;

  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    const fieldMeta = classMeta?.fields.get(key);

    if (fieldMeta?.exclude) {
      if (groupsMatch(fieldMeta.exclude.groups, activeGroups)) {
        continue;
      }
      if (!fieldMeta.exclude.groups || fieldMeta.exclude.groups.length === 0) {
        continue;
      }
    }

    if (excludeAll) {
      if (!fieldMeta?.expose) {
        continue;
      }
      if (!groupsMatch(fieldMeta.expose.groups, activeGroups)) {
        continue;
      }
    }

    let finalValue = value;

    if (fieldMeta?.transforms) {
      for (const transform of fieldMeta.transforms) {
        if (groupsMatch(transform.options?.groups, activeGroups)) {
          finalValue = transform.fn(finalValue, obj);
        }
      }
    }

    if (typeof finalValue === "object" && finalValue !== null && !Array.isArray(finalValue)) {
      finalValue = serialize(finalValue as object, options);
    } else if (Array.isArray(finalValue)) {
      finalValue = finalValue.map((item) =>
        typeof item === "object" && item !== null ? serialize(item, options) : item
      );
    }

    const outputKey = fieldMeta?.expose?.name ?? key;
    result[outputKey] = finalValue;
  }

  return result;
}

/**
 * Creates a serializer function with preset options.
 * @param defaultOptions - Default serialization options
 * @returns Serializer function
 */
export function createSerializer(defaultOptions: SerializeOptions = {}) {
  return function <T extends object>(
    obj: T,
    options: SerializeOptions = {}
  ): Record<string, unknown> {
    return serialize(obj, { ...defaultOptions, ...options });
  };
}

/**
 * Common transform functions.
 */
export const Transforms = {
  /**
   * Converts a Date to ISO string.
   */
  toISOString: (value: unknown): string | unknown => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  },

  /**
   * Converts a value to lowercase string.
   */
  toLowerCase: (value: unknown): string | unknown => {
    if (typeof value === "string") {
      return value.toLowerCase();
    }
    return value;
  },

  /**
   * Converts a value to uppercase string.
   */
  toUpperCase: (value: unknown): string | unknown => {
    if (typeof value === "string") {
      return value.toUpperCase();
    }
    return value;
  },

  /**
   * Rounds a number to specified decimal places.
   */
  round: (decimals: number) => (value: unknown): number | unknown => {
    if (typeof value === "number") {
      const factor = Math.pow(10, decimals);
      return Math.round(value * factor) / factor;
    }
    return value;
  },

  /**
   * Masks a string value (e.g., for sensitive data).
   */
  mask: (visibleChars: number = 4, maskChar: string = "*") => (value: unknown): string | unknown => {
    if (typeof value === "string" && value.length > visibleChars) {
      const visible = value.slice(-visibleChars);
      const masked = maskChar.repeat(value.length - visibleChars);
      return masked + visible;
    }
    return value;
  },

  /**
   * Trims whitespace from a string.
   */
  trim: (value: unknown): string | unknown => {
    if (typeof value === "string") {
      return value.trim();
    }
    return value;
  }
};
