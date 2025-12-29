export interface RouteModel {
  method: string;
  path: string;
  handler: string;
  metadata?: Record<string, unknown>;
}

export function createRouteModel(init: Partial<RouteModel> = {}): RouteModel {
  return {
    method: init.method ?? 'GET',
    path: init.path ?? '/',
    handler: init.handler ?? 'handler',
    metadata: init.metadata,
  };
}
