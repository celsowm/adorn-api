import { buildRegistry } from '../metadata/registry.js';
import type { RouteRegistry } from '../metadata/types.js';

export const bootstrapControllers = (controllers?: Function[]): RouteRegistry =>
  buildRegistry(controllers);
