export interface RouteModel {
  method: string;
  path: string;
  handler: string;
  metadata?: Record<string, unknown>;
}

export function createRouteModel(init: Partial<RouteModel> = {}): RouteModel {
  const result: RouteModel = {
    method: init.method ?? 'GET',
    path: init.path ?? '/',
    handler: init.handler ?? 'handler',
  };
  
  if (init.metadata !== undefined) {
    result.metadata = init.metadata;
  }
  
  return result;
}
