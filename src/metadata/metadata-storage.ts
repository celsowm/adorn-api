import type {
  ControllerMetadata,
  RouteMetadata,
  ParameterMetadata,
} from '../types/metadata.js';

interface PendingParameter {
  name: string;
  type: ParameterMetadata['type'];
  schema?: any;
}

class MetadataStorage {
  private static instance: MetadataStorage;

  private controllers = new WeakMap<Function, ControllerMetadata>();
  private controllerList: Function[] = [];
  private routes = new Map<Function, RouteMetadata[]>();
  private parameterIndex = new Map<string, number>();

  // Pending items for method decorators (processed when class decorator runs)
  private pendingMiddlewares = new WeakMap<Function, Function[]>();
  private pendingGuards = new WeakMap<Function, Function[]>();
  private pendingParameters = new WeakMap<Function, PendingParameter[]>();

  private constructor() { }

  static getInstance(): MetadataStorage {
    if (!MetadataStorage.instance) {
      MetadataStorage.instance = new MetadataStorage();
    }
    return MetadataStorage.instance;
  }

  // --- Controller Methods ---

  setController(controllerClass: Function, metadata: ControllerMetadata): void {
    this.controllers.set(controllerClass, metadata);
    if (!this.controllerList.includes(controllerClass)) {
      this.controllerList.push(controllerClass);
    }
  }

  getController(controllerClass: Function): ControllerMetadata | undefined {
    return this.controllers.get(controllerClass);
  }

  getAllControllers(): Function[] {
    return [...this.controllerList];
  }

  // --- Route Methods ---

  addRoute(controllerClass: Function, route: RouteMetadata): void {
    if (!this.routes.has(controllerClass)) {
      this.routes.set(controllerClass, []);
    }
    this.routes.get(controllerClass)!.push(route);
  }

  getRoutes(controllerClass: Function): RouteMetadata[] {
    return this.routes.get(controllerClass) || [];
  }

  // --- Pending Middleware Methods ---

  addPendingMiddleware(method: Function, middleware: Function): void {
    if (!this.pendingMiddlewares.has(method)) {
      this.pendingMiddlewares.set(method, []);
    }
    this.pendingMiddlewares.get(method)!.push(middleware);
  }

  getPendingMiddlewares(method: Function): Function[] {
    return this.pendingMiddlewares.get(method) || [];
  }

  clearPendingMiddlewares(method: Function): void {
    this.pendingMiddlewares.delete(method);
  }

  // --- Pending Guard Methods ---

  addPendingGuard(method: Function, guard: Function): void {
    if (!this.pendingGuards.has(method)) {
      this.pendingGuards.set(method, []);
    }
    this.pendingGuards.get(method)!.push(guard);
  }

  getPendingGuards(method: Function): Function[] {
    return this.pendingGuards.get(method) || [];
  }

  clearPendingGuards(method: Function): void {
    this.pendingGuards.delete(method);
  }

  // --- Pending Parameter Methods ---

  addPendingParameter(method: Function, param: PendingParameter): void {
    if (!this.pendingParameters.has(method)) {
      this.pendingParameters.set(method, []);
    }
    this.pendingParameters.get(method)!.push(param);
  }

  getPendingParameters(method: Function): PendingParameter[] {
    return this.pendingParameters.get(method) || [];
  }

  clearPendingParameters(method: Function): void {
    this.pendingParameters.delete(method);
  }

  // --- Parameter Index Tracking ---

  getNextParameterIndex(controllerClass: Function, methodName: string): number {
    const key = `${controllerClass.name}.${methodName}`;
    const current = this.parameterIndex.get(key) || 0;
    this.parameterIndex.set(key, current + 1);
    return current;
  }

  // --- Reset/Clear ---

  reset(): void {
    this.controllers = new WeakMap();
    this.pendingMiddlewares = new WeakMap();
    this.pendingGuards = new WeakMap();
    this.pendingParameters = new WeakMap();
    this.controllerList = [];
    this.routes.clear();
    this.parameterIndex.clear();
  }

  clear(): void {
    this.reset();
  }
}

export const metadataStorage = MetadataStorage.getInstance();
