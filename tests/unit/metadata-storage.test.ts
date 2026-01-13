import { describe, it, expect, beforeEach } from 'vitest';
import { metadataStorage } from '../../src/metadata/metadata-storage.js';
import type { ControllerMetadata, RouteMetadata } from '../../src/types/metadata.js';

describe('MetadataStorage', () => {
  beforeEach(() => {
    metadataStorage.reset();
  });

  describe('Controller Metadata', () => {
    it('should store controller metadata', () => {
      class TestController {}

      const metadata: ControllerMetadata = {
        path: '/test',
        middlewares: [],
        guards: [],
      };

      metadataStorage.setController(TestController, metadata);

      const retrieved = metadataStorage.getController(TestController);
      expect(retrieved).toEqual(metadata);
    });

    it('should return undefined for non-existent controller', () => {
      class UnknownController {}

      const retrieved = metadataStorage.getController(UnknownController);
      expect(retrieved).toBeUndefined();
    });

    it('should update existing controller metadata', () => {
      class TestController {}

      metadataStorage.setController(TestController, {
        path: '/old',
        middlewares: [],
        guards: [],
      });

      metadataStorage.setController(TestController, {
        path: '/new',
        middlewares: [],
        guards: [],
      });

      const retrieved = metadataStorage.getController(TestController);
      expect(retrieved?.path).toBe('/new');
    });
  });

  describe('Route Metadata', () => {
    it('should store route metadata', () => {
      class TestController {}

      const route: RouteMetadata = {
        path: '/test',
        method: 'GET',
        handlerName: 'testMethod',
        middlewares: [],
        guards: [],
        parameters: [],
      };

      metadataStorage.addRoute(TestController, route);

      const routes = metadataStorage.getRoutes(TestController);
      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual(route);
    });

    it('should store multiple routes for same controller', () => {
      class TestController {}

      const route1: RouteMetadata = {
        path: '/test1',
        method: 'GET',
        handlerName: 'method1',
        middlewares: [],
        guards: [],
        parameters: [],
      };

      const route2: RouteMetadata = {
        path: '/test2',
        method: 'POST',
        handlerName: 'method2',
        middlewares: [],
        guards: [],
        parameters: [],
      };

      metadataStorage.addRoute(TestController, route1);
      metadataStorage.addRoute(TestController, route2);

      const routes = metadataStorage.getRoutes(TestController);
      expect(routes).toHaveLength(2);
      expect(routes[0]).toEqual(route1);
      expect(routes[1]).toEqual(route2);
    });

    it('should return empty array for controller with no routes', () => {
      class EmptyController {}

      const routes = metadataStorage.getRoutes(EmptyController);
      expect(routes).toEqual([]);
    });
  });

  describe('Get All Controllers', () => {
    it('should return all registered controllers', () => {
      class Controller1 {}
      class Controller2 {}

      metadataStorage.setController(Controller1, {
        path: '/c1',
        middlewares: [],
        guards: [],
      });

      metadataStorage.setController(Controller2, {
        path: '/c2',
        middlewares: [],
        guards: [],
      });

      const controllers = metadataStorage.getAllControllers();
      expect(controllers).toHaveLength(2);
      expect(controllers).toContain(Controller1);
      expect(controllers).toContain(Controller2);
    });

    it('should return empty array when no controllers registered', () => {
      const controllers = metadataStorage.getAllControllers();
      expect(controllers).toEqual([]);
    });
  });

  describe('Parameter Index', () => {
    it('should increment parameter index for same method', () => {
      class TestController {}

      const index1 = metadataStorage.getNextParameterIndex(TestController, 'testMethod');
      const index2 = metadataStorage.getNextParameterIndex(TestController, 'testMethod');
      const index3 = metadataStorage.getNextParameterIndex(TestController, 'testMethod');

      expect(index1).toBe(0);
      expect(index2).toBe(1);
      expect(index3).toBe(2);
    });

    it('should reset parameter index for different methods', () => {
      class TestController {}

      const index1 = metadataStorage.getNextParameterIndex(TestController, 'method1');
      const index2 = metadataStorage.getNextParameterIndex(TestController, 'method2');

      expect(index1).toBe(0);
      expect(index2).toBe(0);
    });
  });

  describe('Reset', () => {
    it('should clear all metadata', () => {
      class TestController {}

      metadataStorage.setController(TestController, {
        path: '/test',
        middlewares: [],
        guards: [],
      });

      metadataStorage.addRoute(TestController, {
        path: '/route',
        method: 'GET',
        handlerName: 'test',
        middlewares: [],
        guards: [],
        parameters: [],
      });

      metadataStorage.reset();

      expect(metadataStorage.getController(TestController)).toBeUndefined();
      expect(metadataStorage.getRoutes(TestController)).toEqual([]);
      expect(metadataStorage.getAllControllers()).toEqual([]);
    });
  });
});
