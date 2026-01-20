import type { Filter, FilterMapping, ParseFilterOptions } from "./types";

/**
 * Parses filter parameters from query parameters.
 * @param query - Query parameters
 * @param mappings - Filter field mappings
 * @returns Parsed filter or undefined
 */
export function parseFilter<T, K extends keyof T>(
  query: Record<string, unknown> | undefined,
  mappings: Record<string, { field: K; operator: "equals" | "contains" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte" }>
): Filter<T, K> | undefined {
  if (!query) {
    return undefined;
  }

  const filter: Filter<T, K> = {};

  for (const [queryKey, value] of Object.entries(query)) {
    const mapping = mappings[queryKey];
    if (!mapping || value === undefined || value === null || value === "") {
      continue;
    }

    const { field, operator } = mapping;
    if (!filter[field]) {
      filter[field] = {};
    }
    filter[field]![operator] = value as T[K];
  }

  return Object.keys(filter).length ? filter : undefined;
}

/**
 * Creates filter mappings for an entity.
 * @param entity - Entity type
 * @param fields - Array of field definitions
 * @returns Filter mappings
 */
export function createFilterMappings<T extends Record<string, unknown>>(
  entity: T,
  fields: Array<{ queryKey: string; field: keyof T; operator?: "equals" | "contains" | "startsWith" | "endsWith" }>
): Record<string, { field: keyof T; operator: "equals" | "contains" | "startsWith" | "endsWith" }> {
  const mappings: Record<string, { field: keyof T; operator: "equals" | "contains" | "startsWith" | "endsWith" }> = {};

  for (const { queryKey, field, operator = "equals" } of fields) {
    mappings[queryKey] = { field, operator };
  }

  return mappings;
}
