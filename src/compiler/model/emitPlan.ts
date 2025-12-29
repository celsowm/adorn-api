import type { RouteModel } from './routeModel.js';

export interface EmitPlan {
  target: string;
  routes: RouteModel[];
}

export function createEmitPlan(target: string): EmitPlan {
  return { target, routes: [] };
}
