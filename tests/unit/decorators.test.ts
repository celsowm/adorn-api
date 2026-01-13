import { describe, it, expect, beforeEach } from 'vitest';
import { Controller } from '../../src/decorators/controller.decorator.js';
import { Get, Post } from '../../src/decorators/http-method.decorator.js';
import { metadataStorage } from '../../src/metadata/metadata-storage.js';

describe('Decorators', () => {
  beforeEach(() => {
    metadataStorage.reset();
  });

  describe('@Controller', () => {
    it('should register controller with path', () => {
      @Controller('/users')
      class UsersController {}

      const metadata = metadataStorage.getController(UsersController);
      expect(metadata).toBeDefined();
      expect(metadata?.path).toBe('/users');
      expect(metadata?.middlewares).toEqual([]);
      expect(metadata?.guards).toEqual([]);
    });

    it('should register multiple controllers', () => {
      @Controller('/users')
      class UsersController {}

      @Controller('/posts')
      class PostsController {}

      const userController = metadataStorage.getController(UsersController);
      const postController = metadataStorage.getController(PostsController);

      expect(userController?.path).toBe('/users');
      expect(postController?.path).toBe('/posts');
    });
  });

  describe('@Get', () => {
    it('should register GET route with path', () => {
      @Controller('/users')
      class UsersController {
        @Get('/profile')
        getProfile() {
          return {};
        }
      }

      const routes = metadataStorage.getRoutes(UsersController);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('GET');
      expect(routes[0].path).toBe('/profile');
      expect(routes[0].handlerName).toBe('getProfile');
    });

    it('should register GET route without path', () => {
      @Controller('/users')
      class UsersController {
        @Get()
        getAll() {
          return [];
        }
      }

      const routes = metadataStorage.getRoutes(UsersController);
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('');
    });
  });

  describe('@Post', () => {
    it('should register POST route', () => {
      @Controller('/users')
      class UsersController {
        @Post('/create')
        createUser() {
          return {};
        }
      }

      const routes = metadataStorage.getRoutes(UsersController);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('POST');
      expect(routes[0].path).toBe('/create');
    });
  });

  describe('Multiple Routes', () => {
    it('should register multiple routes on same controller', () => {
      @Controller('/users')
      class UsersController {
        @Get()
        getAll() {
          return [];
        }

        @Get('/:id')
        getById() {
          return {};
        }

        @Post('/')
        create() {
          return {};
        }
      }

      const routes = metadataStorage.getRoutes(UsersController);
      expect(routes).toHaveLength(3);
      expect(routes[0].method).toBe('GET');
      expect(routes[1].method).toBe('GET');
      expect(routes[2].method).toBe('POST');
    });
  });
});
