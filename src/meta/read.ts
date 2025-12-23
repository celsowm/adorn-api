/**
 * Utilities for reading metadata from decorated classes and methods
 * Uses the standard Stage 3 decorator metadata API
 */

import { CONTROLLER_KEY, ROUTE_KEY, STATUS_KEY, PARAM_KEY, DTO_PROPERTY_KEY } from './keys.js';
import type { ControllerMetadata, RouteMetadata, ParamMetadata, DtoPropertyMetadata } from './types.js';

export type ParamSource = 'path' | 'query' | 'body' | 'header';

/**
 * Get controller metadata from a class
 */
export function getControllerMetadata(target: object): ControllerMetadata | undefined {
  const metadata = target.constructor?.[Symbol.metadata];
  if (!metadata) return undefined;
  
  const controllerMeta = (metadata as Record<symbol, unknown>)[CONTROLLER_KEY];
  if (!controllerMeta) return undefined;
  
  return controllerMeta as ControllerMetadata;
}

/**
 * Get route metadata from a method
 */
export function getRouteMetadata(target: object, propertyKey: string | symbol): RouteMetadata | undefined {
  const metadata = target.constructor?.[Symbol.metadata];
  if (!metadata) return undefined;
  
  const propertyMetadata = metadata[propertyKey];
  if (!propertyMetadata) return undefined;
  
  const routeMeta = (propertyMetadata as Record<symbol, unknown>)[ROUTE_KEY];
  if (!routeMeta) return undefined;
  
  return routeMeta as RouteMetadata;
}

/**
 * Get all methods that have route metadata
 */
export function getRouteMethods(target: object): Map<string | symbol, RouteMetadata> {
  const metadata = target.constructor?.[Symbol.metadata];
  if (!metadata) return new Map();
  
  const routes = new Map<string | symbol, RouteMetadata>();
  
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof key === 'string' && key !== 'constructor' && value && typeof value === 'object') {
      const routeMeta = (value as Record<symbol, unknown>)[ROUTE_KEY];
      if (routeMeta) {
        routes.set(key, routeMeta as RouteMetadata);
      }
    }
  }
  
  return routes;
}

/**
 * Get status code metadata for a method
 */
export function getStatusMetadata(target: object, propertyKey: string | symbol): number | undefined {
  const metadata = target.constructor?.[Symbol.metadata];
  if (!metadata) return undefined;
  
  const propertyMetadata = metadata[propertyKey];
  if (!propertyMetadata) return undefined;
  
  const statusMeta = (propertyMetadata as Record<symbol, unknown>)[STATUS_KEY];
  if (statusMeta === undefined) return undefined;
  
  return statusMeta as number;
}

/**
 * Get parameter metadata for a method
 */
export function getParamMetadata(target: object, propertyKey: string | symbol): ParamMetadata[] {
  const metadata = target.constructor?.[Symbol.metadata];
  if (!metadata) return [];
  
  const propertyMetadata = metadata[propertyKey];
  if (!propertyMetadata) return [];
  
  const paramsMeta = (propertyMetadata as Record<symbol, unknown>)[PARAM_KEY];
  if (!paramsMeta) return [];
  
  return paramsMeta as ParamMetadata[];
}

/**
 * Get DTO property metadata
 */
export function getDtoPropertyMetadata(target: object, propertyKey: string | symbol): DtoPropertyMetadata | undefined {
  const metadata = target.constructor?.[Symbol.metadata];
  if (!metadata) return undefined;
  
  const propertyMetadata = metadata[propertyKey];
  if (!propertyMetadata) return undefined;
  
  const dtoMeta = (propertyMetadata as Record<symbol, unknown>)[DTO_PROPERTY_KEY];
  if (!dtoMeta) return undefined;
  
  return dtoMeta as DtoPropertyMetadata;
}
