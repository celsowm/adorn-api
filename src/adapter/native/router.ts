import type { HttpMethod } from "../../core/types";
import type { RouteMeta } from "../../core/metadata";

/**
 * Result of a route match.
 */
export interface RouteMatch {
  controller: any;
  route: RouteMeta;
  params: Record<string, string>;
}

/**
 * A simple router for matching URL paths to routes.
 */
export class Router {
  private routes: Array<{
    method: HttpMethod;
    pattern: RegExp;
    paramNames: string[];
    controller: any;
    route: RouteMeta;
  }> = [];

  /**
   * Registers a route in the router.
   */
  add(controller: any, route: RouteMeta, basePath: string): void {
    const fullPath = this.joinPaths(basePath, route.path);
    const { pattern, paramNames } = this.compilePath(fullPath);
    this.routes.push({
      method: route.httpMethod,
      pattern,
      paramNames,
      controller,
      route
    });
  }

  /**
   * Matches an incoming request to a registered route.
   */
  match(method: string, path: string): RouteMatch | undefined {
    const normalizedMethod = method.toLowerCase() as HttpMethod;
    const url = new URL(path, "http://localhost");
    const pathname = url.pathname;

    for (const entry of this.routes) {
      if (entry.method !== normalizedMethod) {
        continue;
      }

      const match = entry.pattern.exec(pathname);
      if (match) {
        const params: Record<string, string> = {};
        for (let i = 0; i < entry.paramNames.length; i++) {
          params[entry.paramNames[i]] = decodeURIComponent(match[i + 1]);
        }
        return {
          controller: entry.controller,
          route: entry.route,
          params
        };
      }
    }

    return undefined;
  }

  private joinPaths(base: string, path: string): string {
    const normalizedBase = base.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}` || "/";
  }

  private compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    const patternStr = path
      .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return "([^/]+)";
      })
      .replace(/\//g, "\\/");

    return {
      pattern: new RegExp(`^${patternStr}$`),
      paramNames
    };
  }
}
