/**
 * Options for string coercion.
 */
export interface StringCoerceOptions {
  /** Whether to trim whitespace */
  trim?: boolean;
  /** How to handle empty strings */
  empty?: "allow" | "reject";
}

/**
 * Options for number coercion.
 * @extends StringCoerceOptions
 */
export interface NumberCoerceOptions extends StringCoerceOptions {
  /** Minimum value constraint */
  min?: number;
  /** Maximum value constraint */
  max?: number;
  /** Whether to clamp values to min/max range */
  clamp?: boolean;
}

/**
 * Options for boolean coercion.
 * @extends StringCoerceOptions
 */
export interface BooleanCoerceOptions extends StringCoerceOptions {
  /** Values that should be treated as true */
  trueValues?: string[];
  /** Values that should be treated as false */
  falseValues?: string[];
  /** Whether matching should be case sensitive */
  caseSensitive?: boolean;
}

/**
 * Normalizes a value to a single string.
 * @param value - Value to normalize
 * @param options - String coercion options
 * @returns Normalized string or undefined
 */
export function normalizeSingle(
  value: unknown,
  options: StringCoerceOptions = {}
): string | undefined {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (resolved === undefined || resolved === null) {
    return undefined;
  }
  let text = typeof resolved === "string" ? resolved : String(resolved);
  if (options.trim ?? true) {
    text = text.trim();
  }
  if (!text && options.empty !== "allow") {
    return undefined;
  }
  return text;
}

/**
 * Parses a value as a number.
 * @param value - Value to parse
 * @param options - Number coercion options
 * @returns Parsed number or undefined
 */
export function parseNumber(
  value: unknown,
  options: NumberCoerceOptions = {}
): number | undefined {
  const parsed = parseNumberRaw(value, options);
  if (parsed === undefined) {
    return undefined;
  }
  return applyRange(parsed, options);
}

/**
 * Parses a value as an integer.
 * @param value - Value to parse
 * @param options - Number coercion options
 * @returns Parsed integer or undefined
 */
export function parseInteger(
  value: unknown,
  options: NumberCoerceOptions = {}
): number | undefined {
  const parsed = parseNumberRaw(value, options);
  if (parsed === undefined || !Number.isInteger(parsed)) {
    return undefined;
  }
  return applyRange(parsed, options);
}

/**
 * Parses a value as a boolean.
 * @param value - Value to parse
 * @param options - Boolean coercion options
 * @returns Parsed boolean or undefined
 */
export function parseBoolean(
  value: unknown,
  options: BooleanCoerceOptions = {}
): boolean | undefined {
  const text = normalizeSingle(value, options);
  if (text === undefined) {
    return undefined;
  }
  const caseSensitive = options.caseSensitive ?? false;
  const token = caseSensitive ? text : text.toLowerCase();
  const trueValues = options.trueValues ?? ["true", "1"];
  const falseValues = options.falseValues ?? ["false", "0"];

  if (matchesToken(token, trueValues, caseSensitive)) {
    return true;
  }
  if (matchesToken(token, falseValues, caseSensitive)) {
    return false;
  }
  return undefined;
}

/**
 * Parses a value as an ID (positive integer).
 * @param value - Value to parse
 * @param options - Number coercion options
 * @returns Parsed ID or undefined
 */
export function parseId(
  value: unknown,
  options: NumberCoerceOptions = {}
): number | undefined {
  return parseInteger(value, { min: 1, ...options });
}

/**
 * Coercion utility object providing functions for type coercion.
 */
export const coerce = {
  /** String coercion function */
  string: normalizeSingle,
  /** Number coercion function */
  number: parseNumber,
  /** Integer coercion function */
  integer: parseInteger,
  /** Boolean coercion function */
  boolean: parseBoolean,
  /** ID coercion function */
  id: parseId
};

function parseNumberRaw(
  value: unknown,
  options: StringCoerceOptions
): number | undefined {
  const text = normalizeSingle(value, options);
  if (text === undefined) {
    return undefined;
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function applyRange(
  value: number,
  options: NumberCoerceOptions
): number | undefined {
  if (options.min !== undefined && value < options.min) {
    return options.clamp ? options.min : undefined;
  }
  if (options.max !== undefined && value > options.max) {
    return options.clamp ? options.max : undefined;
  }
  return value;
}

function matchesToken(
  token: string,
  values: string[],
  caseSensitive: boolean
): boolean {
  if (caseSensitive) {
    return values.includes(token);
  }
  const normalizedValues = values.map((value) => value.toLowerCase());
  return normalizedValues.includes(token);
}
