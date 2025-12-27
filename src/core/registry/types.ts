import type { ControllerMeta, RouteMeta } from '../../metadata/keys';

export type ControllerCtor<T = any> = new (...args: any[]) => T;

export type ControllerEntry = {
  ctor: ControllerCtor;
  meta: ControllerMeta;
};

export type RouteEntry = {
  method: RouteMeta['method'];
  /**
   * Full, normalized path template, e.g. "/users/{id}"
   */
  fullPath: string;

  /**
   * Raw route template as declared on the method, e.g. "/{id}"
   */
  routePath: string;

  /**
   * The handler name on the controller, e.g. "get"
   */
  handlerName: string;

  controller: ControllerCtor;

  /**
   * Whatever the decorator carried (docs/security/etc). Compiler can refine later.
   */
  options?: unknown;
};

export type Registry = {
  controllers: ControllerEntry[];
  routes: RouteEntry[];
};
