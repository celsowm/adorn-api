import type { RouteMetadata } from '../types/metadata.js';

export interface RouteOptions {
  summary?: string;
  description?: string;
  tags?: string[];
  middlewares?: Function[];
  guards?: Function[];
  params?: Array<{ name: string; type: 'param' | 'query' | 'body' | 'header' }>;
}

export function enhanceRouteMetadata(route: RouteMetadata, options?: RouteOptions): RouteMetadata {
  if (!options) return route;

  return {
    ...route,
    summary: options.summary || route.summary,
    description: options.description || route.description,
    tags: options.tags || route.tags,
    middlewares: options.middlewares || route.middlewares,
    guards: options.guards || route.guards,
    parameters: options.params
      ? options.params.map((p, index) => ({
          name: p.name,
          type: p.type,
          index,
          required: p.type === 'param',
        }))
      : route.parameters,
  };
}
