/**
 * Simple Dependency Injection container for Adorn API
 */

export class Container {
  private static instance: Container;
  private services = new Map<string, any>();

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
  public register<T>(token: string, implementation: T): void {
    this.services.set(token, implementation);
  }

  /**
   * Resolve a service or controller
   * If not registered, it tries to instantiate it if it's a class
   */
  public resolve<T>(token: string | (new (...args: any[]) => T)): T {
    const key = typeof token === 'string' ? token : token.name;
    
    if (this.services.has(key)) {
      const entry = this.services.get(key);
      // If it's a class constructor, instantiate it
      if (typeof entry === 'function' && /^\s*class\s+/.test(entry.toString())) {
        return new entry();
      }
      return entry;
    }

    if (typeof token === 'function') {
      const instance = new token();
      this.services.set(key, instance);
      return instance;
    }

    throw new Error(`Service ${key} not found in container`);
  }

  /**
   * Reset the container (mainly for tests)
   */
  public reset(): void {
    this.services.clear();
  }
}

export const container = Container.getInstance();
