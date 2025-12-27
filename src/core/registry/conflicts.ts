import type { RouteEntry } from './types';

export class RouteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RouteConflictError';
  }
}

export function assertNoRouteConflicts(routes: RouteEntry[]): void {
  const seen = new Map<string, RouteEntry>();

  for (const r of routes) {
    const key = `${r.method} ${r.fullPath}`;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, r);
      continue;
    }

    throw new RouteConflictError(
      `Route conflict for "${key}": ` +
        `${prev.controller.name}.${prev.handlerName} and ` +
        `${r.controller.name}.${r.handlerName}`,
    );
  }
}
