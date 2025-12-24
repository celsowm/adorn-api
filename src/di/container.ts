/**
 * Simple Dependency Injection container for Adorn API
 */

export type Scope = 'singleton' | 'transient' | 'request';

interface ServiceDefinition {
  implementation: any;
  scope: Scope;
  instance?: any;
}

export class Container {
  private static instance: Container;
  private services = new Map<string, ServiceDefinition>();

  private constructor() {}

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Register a service or controller
   */
  public register<T>(token: string | (new (...args: any[]) => T), implementation: any, scope: Scope = 'singleton'): void {
    const key = typeof token === 'string' ? token : token.name;
    this.services.set(key, { implementation, scope });
  }

  /**
   * Resolve a service or controller
   */
  public resolve<T>(token: string | (new (...args: any[]) => T), requestContext?: Map<string, any>): T {
    const key = typeof token === 'string' ? token : token.name;
    
    // Check if it's in request context
    if (requestContext && requestContext.has(key)) {
      return requestContext.get(key);
    }

    const definition = this.services.get(key);

    if (definition) {
      if (definition.scope === 'singleton') {
        if (!definition.instance) {
          definition.instance = this.instantiate(definition.implementation, requestContext);
        }
        return definition.instance;
      } else if (definition.scope === 'request') {
        if (!requestContext) {
          throw new Error(`Cannot resolve request-scoped service ${key} without request context`);
        }
        const instance = this.instantiate(definition.implementation, requestContext);
        requestContext.set(key, instance);
        return instance;
      } else {
        // transient
        return this.instantiate(definition.implementation, requestContext);
      }
    }

    // Auto-registration for classes (default to transient for controllers/services not registered)
    if (typeof token === 'function') {
      // In a real DI, we'd check metadata for scope. Defaulting to transient to avoid race conditions.
      return this.instantiate(token, requestContext);
    }

    throw new Error(`Service ${key} not found in container`);
  }

  private instantiate(implementation: any, requestContext?: Map<string, any>): any {
    if (typeof implementation !== 'function') {
      return implementation;
    }

    // If it's a class, try to resolve dependencies (primitive DI)
    // In a real framework, we'd use reflect-metadata to get constructor param types
    // For now, we'll support parameterless constructors or manually registered dependencies
    try {
      return new implementation();
    } catch (e) {
      throw new Error(`Failed to instantiate ${implementation.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Reset the container (mainly for tests)
   */
  public reset(): void {
    this.services.clear();
  }
}

export const container = Container.getInstance();
