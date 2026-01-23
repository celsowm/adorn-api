/**
 * Lifecycle hook interfaces for controllers and services.
 */

/**
 * Called after the instance is created.
 * Use this for initialization logic that depends on the instance being fully constructed.
 */
export interface OnModuleInit {
  onModuleInit(): void | Promise<void>;
}

/**
 * Called after all controllers have been initialized and attached to the application.
 * Use this for logic that depends on other modules being ready.
 */
export interface OnApplicationBootstrap {
  onApplicationBootstrap(): void | Promise<void>;
}

/**
 * Called when the application is shutting down.
 * Use this for cleanup logic (closing connections, releasing resources).
 */
export interface OnApplicationShutdown {
  onApplicationShutdown(signal?: string): void | Promise<void>;
}

/**
 * Called before the application shuts down, before OnApplicationShutdown.
 * Use this for graceful shutdown preparation.
 */
export interface BeforeApplicationShutdown {
  beforeApplicationShutdown(signal?: string): void | Promise<void>;
}

/**
 * Type guard to check if an object implements OnModuleInit.
 */
export function hasOnModuleInit(instance: unknown): instance is OnModuleInit {
  return (
    instance !== null &&
    typeof instance === "object" &&
    "onModuleInit" in instance &&
    typeof (instance as OnModuleInit).onModuleInit === "function"
  );
}

/**
 * Type guard to check if an object implements OnApplicationBootstrap.
 */
export function hasOnApplicationBootstrap(instance: unknown): instance is OnApplicationBootstrap {
  return (
    instance !== null &&
    typeof instance === "object" &&
    "onApplicationBootstrap" in instance &&
    typeof (instance as OnApplicationBootstrap).onApplicationBootstrap === "function"
  );
}

/**
 * Type guard to check if an object implements OnApplicationShutdown.
 */
export function hasOnApplicationShutdown(instance: unknown): instance is OnApplicationShutdown {
  return (
    instance !== null &&
    typeof instance === "object" &&
    "onApplicationShutdown" in instance &&
    typeof (instance as OnApplicationShutdown).onApplicationShutdown === "function"
  );
}

/**
 * Type guard to check if an object implements BeforeApplicationShutdown.
 */
export function hasBeforeApplicationShutdown(instance: unknown): instance is BeforeApplicationShutdown {
  return (
    instance !== null &&
    typeof instance === "object" &&
    "beforeApplicationShutdown" in instance &&
    typeof (instance as BeforeApplicationShutdown).beforeApplicationShutdown === "function"
  );
}

/**
 * Registry to track instances for lifecycle management.
 */
export class LifecycleRegistry {
  private instances: unknown[] = [];
  private isBootstrapped = false;

  /**
   * Register an instance for lifecycle management.
   */
  register(instance: unknown): void {
    this.instances.push(instance);
  }

  /**
   * Get all registered instances.
   */
  getInstances(): unknown[] {
    return [...this.instances];
  }

  /**
   * Call onModuleInit on an instance if it implements the interface.
   */
  async callOnModuleInit(instance: unknown): Promise<void> {
    if (hasOnModuleInit(instance)) {
      await instance.onModuleInit();
    }
  }

  /**
   * Call onApplicationBootstrap on all registered instances.
   */
  async callOnApplicationBootstrap(): Promise<void> {
    if (this.isBootstrapped) {
      return;
    }
    for (const instance of this.instances) {
      if (hasOnApplicationBootstrap(instance)) {
        await instance.onApplicationBootstrap();
      }
    }
    this.isBootstrapped = true;
  }

  /**
   * Call shutdown hooks on all registered instances.
   */
  async callShutdownHooks(signal?: string): Promise<void> {
    // Call beforeApplicationShutdown first
    for (const instance of this.instances) {
      if (hasBeforeApplicationShutdown(instance)) {
        await instance.beforeApplicationShutdown(signal);
      }
    }
    // Then call onApplicationShutdown
    for (const instance of this.instances) {
      if (hasOnApplicationShutdown(instance)) {
        await instance.onApplicationShutdown(signal);
      }
    }
  }

  /**
   * Clear all registered instances.
   */
  clear(): void {
    this.instances = [];
    this.isBootstrapped = false;
  }
}

/**
 * Global lifecycle registry instance.
 */
export const lifecycleRegistry = new LifecycleRegistry();
