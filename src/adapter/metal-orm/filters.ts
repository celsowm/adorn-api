import type { Filter, FilterFieldInput, FilterMapping, FilterOperator, ParseFilterOptions } from "./types";

/**
 * Parses filter parameters from query parameters.
 * @param query - Query parameters
 * @param mappings - Filter field mappings
 * @returns Parsed filter or undefined
 */
export function parseFilter<T, K extends keyof T>(
  query: Record<string, unknown> | undefined,
  mappings: Record<string, FilterMapping<T>>
): Filter<T, K> | undefined;
export function parseFilter<T, K extends keyof T>(
  options: ParseFilterOptions<T>
): Filter<T, K> | undefined;
export function parseFilter<T, K extends keyof T>(
  queryOrOptions: Record<string, unknown> | ParseFilterOptions<T> | undefined,
  mappings?: Record<string, FilterMapping<T>>
): Filter<T, K> | undefined {
  const options = mappings ? undefined : (queryOrOptions as ParseFilterOptions<T> | undefined);
  const query = mappings
    ? (queryOrOptions as Record<string, unknown> | undefined)
    : options?.query;
  const fieldMappings = mappings ?? options?.fieldMappings;

  if (!query || !fieldMappings) {
    return undefined;
  }

  const filter: Record<string, unknown> = {};
  let hasValues = false;

  for (const [queryKey, mapping] of Object.entries(fieldMappings)) {
    if (!mapping) {
      continue;
    }
    const value = getQueryValue(query, queryKey);
    if (isSkippableValue(value)) {
      continue;
    }
    const operator = mapping.operator ?? "equals";
    const fieldPath = normalizePath(mapping.field as string | string[]);
    if (!fieldPath.length) {
      continue;
    }
    setFilterValue(filter, fieldPath, operator, value);
    hasValues = true;
  }

  return hasValues ? (filter as Filter<T, K>) : undefined;
}

/**
 * Creates filter mappings for an entity.
 * @param entity - Entity type
 * @param fields - Array of field definitions
 * @returns Filter mappings
 */
export function createFilterMappings<T extends Record<string, unknown>>(
  _entity: T,
  fields: Array<{ queryKey: string; field: FilterFieldInput<T>; operator?: FilterOperator }>
): Record<string, FilterMapping<T>> {
  const mappings: Record<string, FilterMapping<T>> = {};

  for (const { queryKey, field, operator = "equals" } of fields) {
    mappings[queryKey] = { field, operator };
  }

  return mappings;
}

const RELATION_OPERATORS = new Set<FilterOperator>(["isEmpty", "isNotEmpty"]);

function normalizePath(path: string | string[]): string[] {
  if (Array.isArray(path)) {
    return path.map(String).filter((segment) => segment.length > 0);
  }
  return splitPath(path);
}

function splitPath(path: string): string[] {
  if (!path) {
    return [];
  }
  const normalized = path.replace(/\[(.*?)\]/g, ".$1");
  return normalized
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function getQueryValue(query: Record<string, unknown>, queryKey: string): unknown {
  if (queryKey in query) {
    return query[queryKey];
  }
  const path = splitPath(queryKey);
  if (!path.length) {
    return undefined;
  }
  return getValueAtPath(query, path);
}

function getValueAtPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function isSkippableValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

function setFilterValue(
  filter: Record<string, unknown>,
  fieldPath: string[],
  operator: FilterOperator,
  value: unknown
): void {
  if (!fieldPath.length) {
    return;
  }

  let cursor = filter;

  if (RELATION_OPERATORS.has(operator)) {
    for (const segment of fieldPath) {
      cursor = ensureObject(cursor, segment);
    }
    cursor[operator] = value;
    return;
  }

  for (let index = 0; index < fieldPath.length - 1; index += 1) {
    cursor = ensureObject(cursor, fieldPath[index]);
  }

  const fieldKey = fieldPath[fieldPath.length - 1];
  const fieldTarget = ensureObject(cursor, fieldKey);
  fieldTarget[operator] = value;
}

function ensureObject(container: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = container[key];
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }
  const next: Record<string, unknown> = {};
  container[key] = next;
  return next;
}
