import type { ControllerMetadata, RouteMetadata } from '../types/metadata.js';

export class MetadataStorage {
  private static instance: MetadataStorage;

  private controllers = new WeakMap<Function, ControllerMetadata>();
  private controllerList: Function[] = [];
  private routes = new Map<Function, RouteMetadata[]>();
  private parameterIndex = new Map<string, number>();
  private currentClassBeingDecorated: Function | null = null;

  private constructor() {}

  static getInstance(): MetadataStorage {
    if (!MetadataStorage.instance) {
      MetadataStorage.instance = new MetadataStorage();
    }
    return MetadataStorage.instance;
  }

  setCurrentClass(controllerClass: Function): void {
    this.currentClassBeingDecorated = controllerClass;
  }

  getCurrentClass(): Function | null {
    return this.currentClassBeingDecorated;
  }

  clearCurrentClass(): void {
    this.currentClassBeingDecorated = null;
  }

  setController(controllerClass: Function, metadata: ControllerMetadata): void {
    this.controllers.set(controllerClass, metadata);
    if (!this.controllerList.includes(controllerClass)) {
      this.controllerList.push(controllerClass);
    }
  }

  getController(controllerClass: Function): ControllerMetadata | undefined {
    return this.controllers.get(controllerClass);
  }

  addRoute(controllerClass: Function, route: RouteMetadata): void {
    if (!this.routes.has(controllerClass)) {
      this.routes.set(controllerClass, []);
    }
    this.routes.get(controllerClass)!.push(route);
  }

  getRoutes(controllerClass: Function): RouteMetadata[] {
    return this.routes.get(controllerClass) || [];
  }

  getAllControllers(): Function[] {
    return [...this.controllerList];
  }

  getNextParameterIndex(controllerClass: Function, methodName: string): number {
    const key = `${controllerClass.name}.${methodName}`;
    const current = this.parameterIndex.get(key) || 0;
    this.parameterIndex.set(key, current + 1);
    return current;
  }

  reset(): void {
    this.controllers = new WeakMap();
    this.controllerList = [];
    this.routes.clear();
    this.parameterIndex.clear();
    this.currentClassBeingDecorated = null;
  }

  clear(): void {
    this.reset();
  }
}

export const metadataStorage = MetadataStorage.getInstance();
