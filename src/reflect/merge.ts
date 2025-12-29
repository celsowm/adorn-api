export interface RouteOptionsPatch {
  [key: string]: unknown;
}

export function mergeRouteOptions(base: RouteOptionsPatch = {},
  overrides: RouteOptionsPatch = {}) {
  return { ...base, ...overrides };
}
