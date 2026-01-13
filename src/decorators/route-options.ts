import type { z } from 'zod';
import type { RouteMetadata } from '../types/metadata.js';

export interface RouteOptions {
  summary?: string;
  description?: string;
  tags?: string[];
  middlewares?: Function[];
  guards?: Function[];

  // Zod schema support
  params?: z.ZodType<any>;
  body?: z.ZodType<any>;
  query?: z.ZodType<any>;
}

export function enhanceRouteMetadata(
  route: RouteMetadata,
  options?: RouteOptions
): RouteMetadata {
  if (!options) return route;

  const enhanced: RouteMetadata = {
    ...route,
    summary: options.summary ?? route.summary,
    description: options.description ?? route.description,
    tags: options.tags ?? route.tags,
    middlewares: [...route.middlewares, ...(options.middlewares ?? [])],
    guards: [...route.guards, ...(options.guards ?? [])],
  };

  // Store schemas for later processing
  if (options.params || options.body || options.query) {
    enhanced.schemas = {
      params: options.params,
      body: options.body,
      query: options.query,
    };
  }

  return enhanced;
}
