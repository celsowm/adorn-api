import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  OnModuleInit,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  BeforeApplicationShutdown,
  hasOnModuleInit,
  hasOnApplicationBootstrap,
  hasOnApplicationShutdown,
  hasBeforeApplicationShutdown,
  LifecycleRegistry
} from "../src/core/lifecycle";

describe("Lifecycle Type Guards", () => {
  describe("hasOnModuleInit", () => {
    it("returns true for objects with onModuleInit method", () => {
      const obj = { onModuleInit: () => {} };
      expect(hasOnModuleInit(obj)).toBe(true);
    });

    it("returns false for objects without onModuleInit", () => {
      const obj = { someOtherMethod: () => {} };
      expect(hasOnModuleInit(obj)).toBe(false);
    });

    it("returns false for null", () => {
      expect(hasOnModuleInit(null)).toBe(false);
    });

    it("returns false for non-objects", () => {
      expect(hasOnModuleInit("string")).toBe(false);
      expect(hasOnModuleInit(123)).toBe(false);
    });

    it("returns false when onModuleInit is not a function", () => {
      const obj = { onModuleInit: "not a function" };
      expect(hasOnModuleInit(obj)).toBe(false);
    });
  });

  describe("hasOnApplicationBootstrap", () => {
    it("returns true for objects with onApplicationBootstrap method", () => {
      const obj = { onApplicationBootstrap: () => {} };
      expect(hasOnApplicationBootstrap(obj)).toBe(true);
    });

    it("returns false for objects without onApplicationBootstrap", () => {
      const obj = { someOtherMethod: () => {} };
      expect(hasOnApplicationBootstrap(obj)).toBe(false);
    });
  });

  describe("hasOnApplicationShutdown", () => {
    it("returns true for objects with onApplicationShutdown method", () => {
      const obj = { onApplicationShutdown: () => {} };
      expect(hasOnApplicationShutdown(obj)).toBe(true);
    });

    it("returns false for objects without onApplicationShutdown", () => {
      const obj = { someOtherMethod: () => {} };
      expect(hasOnApplicationShutdown(obj)).toBe(false);
    });
  });

  describe("hasBeforeApplicationShutdown", () => {
    it("returns true for objects with beforeApplicationShutdown method", () => {
      const obj = { beforeApplicationShutdown: () => {} };
      expect(hasBeforeApplicationShutdown(obj)).toBe(true);
    });

    it("returns false for objects without beforeApplicationShutdown", () => {
      const obj = { someOtherMethod: () => {} };
      expect(hasBeforeApplicationShutdown(obj)).toBe(false);
    });
  });
});

describe("LifecycleRegistry", () => {
  let registry: LifecycleRegistry;

  beforeEach(() => {
    registry = new LifecycleRegistry();
  });

  describe("register and getInstances", () => {
    it("registers and retrieves instances", () => {
      const instance1 = { name: "first" };
      const instance2 = { name: "second" };

      registry.register(instance1);
      registry.register(instance2);

      const instances = registry.getInstances();
      expect(instances).toHaveLength(2);
      expect(instances).toContain(instance1);
      expect(instances).toContain(instance2);
    });

    it("returns a copy of instances array", () => {
      const instance = { name: "test" };
      registry.register(instance);

      const instances1 = registry.getInstances();
      const instances2 = registry.getInstances();

      expect(instances1).not.toBe(instances2);
      expect(instances1).toEqual(instances2);
    });
  });

  describe("callOnModuleInit", () => {
    it("calls onModuleInit when present", async () => {
      const onModuleInit = vi.fn();
      const instance: OnModuleInit = { onModuleInit };

      await registry.callOnModuleInit(instance);

      expect(onModuleInit).toHaveBeenCalledTimes(1);
    });

    it("handles async onModuleInit", async () => {
      const order: string[] = [];
      const instance: OnModuleInit = {
        async onModuleInit() {
          await new Promise((r) => setTimeout(r, 10));
          order.push("init");
        }
      };

      await registry.callOnModuleInit(instance);
      order.push("after");

      expect(order).toEqual(["init", "after"]);
    });

    it("does nothing for objects without onModuleInit", async () => {
      const instance = { someMethod: vi.fn() };
      await registry.callOnModuleInit(instance);
      expect(instance.someMethod).not.toHaveBeenCalled();
    });
  });

  describe("callOnApplicationBootstrap", () => {
    it("calls onApplicationBootstrap on all registered instances", async () => {
      const bootstrap1 = vi.fn();
      const bootstrap2 = vi.fn();

      registry.register({ onApplicationBootstrap: bootstrap1 });
      registry.register({ onApplicationBootstrap: bootstrap2 });
      registry.register({ otherMethod: vi.fn() });

      await registry.callOnApplicationBootstrap();

      expect(bootstrap1).toHaveBeenCalledTimes(1);
      expect(bootstrap2).toHaveBeenCalledTimes(1);
    });

    it("only calls bootstrap once even if called multiple times", async () => {
      const bootstrap = vi.fn();
      registry.register({ onApplicationBootstrap: bootstrap });

      await registry.callOnApplicationBootstrap();
      await registry.callOnApplicationBootstrap();

      expect(bootstrap).toHaveBeenCalledTimes(1);
    });

    it("handles async onApplicationBootstrap", async () => {
      const order: string[] = [];

      registry.register({
        async onApplicationBootstrap() {
          await new Promise((r) => setTimeout(r, 10));
          order.push("bootstrap1");
        }
      });
      registry.register({
        async onApplicationBootstrap() {
          order.push("bootstrap2");
        }
      });

      await registry.callOnApplicationBootstrap();

      expect(order).toEqual(["bootstrap1", "bootstrap2"]);
    });
  });

  describe("callShutdownHooks", () => {
    it("calls beforeApplicationShutdown before onApplicationShutdown", async () => {
      const order: string[] = [];

      registry.register({
        beforeApplicationShutdown() {
          order.push("before");
        },
        onApplicationShutdown() {
          order.push("shutdown");
        }
      });

      await registry.callShutdownHooks();

      expect(order).toEqual(["before", "shutdown"]);
    });

    it("passes signal to shutdown hooks", async () => {
      const beforeShutdown = vi.fn();
      const shutdown = vi.fn();

      registry.register({
        beforeApplicationShutdown: beforeShutdown,
        onApplicationShutdown: shutdown
      });

      await registry.callShutdownHooks("SIGTERM");

      expect(beforeShutdown).toHaveBeenCalledWith("SIGTERM");
      expect(shutdown).toHaveBeenCalledWith("SIGTERM");
    });

    it("calls all beforeApplicationShutdown hooks before any onApplicationShutdown", async () => {
      const order: string[] = [];

      registry.register({
        beforeApplicationShutdown() {
          order.push("before1");
        },
        onApplicationShutdown() {
          order.push("shutdown1");
        }
      });
      registry.register({
        beforeApplicationShutdown() {
          order.push("before2");
        },
        onApplicationShutdown() {
          order.push("shutdown2");
        }
      });

      await registry.callShutdownHooks();

      expect(order).toEqual(["before1", "before2", "shutdown1", "shutdown2"]);
    });
  });

  describe("clear", () => {
    it("removes all registered instances", () => {
      registry.register({ name: "test1" });
      registry.register({ name: "test2" });

      registry.clear();

      expect(registry.getInstances()).toHaveLength(0);
    });

    it("allows bootstrap to be called again after clear", async () => {
      const bootstrap = vi.fn();
      registry.register({ onApplicationBootstrap: bootstrap });

      await registry.callOnApplicationBootstrap();
      registry.clear();

      registry.register({ onApplicationBootstrap: bootstrap });
      await registry.callOnApplicationBootstrap();

      expect(bootstrap).toHaveBeenCalledTimes(2);
    });
  });
});

describe("Lifecycle Integration", () => {
  it("supports class implementing multiple lifecycle interfaces", async () => {
    const order: string[] = [];

    class MyService
      implements
        OnModuleInit,
        OnApplicationBootstrap,
        BeforeApplicationShutdown,
        OnApplicationShutdown
    {
      async onModuleInit() {
        order.push("init");
      }

      async onApplicationBootstrap() {
        order.push("bootstrap");
      }

      async beforeApplicationShutdown(signal?: string) {
        order.push(`before-shutdown:${signal}`);
      }

      async onApplicationShutdown(signal?: string) {
        order.push(`shutdown:${signal}`);
      }
    }

    const registry = new LifecycleRegistry();
    const service = new MyService();

    registry.register(service);
    await registry.callOnModuleInit(service);
    await registry.callOnApplicationBootstrap();
    await registry.callShutdownHooks("SIGINT");

    expect(order).toEqual([
      "init",
      "bootstrap",
      "before-shutdown:SIGINT",
      "shutdown:SIGINT"
    ]);
  });
});
