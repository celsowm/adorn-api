export interface StringCoerceOptions {
  trim?: boolean;
  empty?: "allow" | "reject";
}

export interface NumberCoerceOptions extends StringCoerceOptions {
  min?: number;
  max?: number;
  clamp?: boolean;
}

export interface BooleanCoerceOptions extends StringCoerceOptions {
  trueValues?: string[];
  falseValues?: string[];
  caseSensitive?: boolean;
}

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

export function parseId(
  value: unknown,
  options: NumberCoerceOptions = {}
): number | undefined {
  return parseInteger(value, { min: 1, ...options });
}

export const coerce = {
  string: normalizeSingle,
  number: parseNumber,
  integer: parseInteger,
  boolean: parseBoolean,
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
