import { RouteConfigError } from './errors.js';
import type { SchemaRef } from './schema.js';
import type { Guard, IncludePolicy, RouteStub } from './metadata.js';
import { readControllerMeta, readRouteStubs } from './metadata.js';

export type RouteIR = {
  controller: Function;

  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string; // OpenAPI style: /users/{id}
  handlerName: string;

  schemas: {
    params?: SchemaRef;
    query: SchemaRef; // required by rule
    body?: SchemaRef; // required for POST/PUT/PATCH
    response: SchemaRef; // required always
  };

  includePolicy?: IncludePolicy;
  guards: Guard[];
};

export type ControllerIR = {
  controller: Function;
  basePath: string;
  tags?: string[];
  routes: RouteIR[];
};

export type ManifestIR = {
  controllers: ControllerIR[];
  routes: RouteIR[];
};

function normalizeSlashes(path: string): string {
  // Normalize Windows separators then normalize repeated slashes.
  path = path.replace(/\\/g, '/');
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/+/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

function joinPaths(basePath: string, routePath: string): string {
  const base = normalizeSlashes(basePath);
  const route = normalizeSlashes(routePath);
  if (base === '/') return route;
  if (route === '/') return base;
  return normalizeSlashes(`${base}${route}`);
}

function canonicalMethod(method: string): RouteIR['method'] {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') return m;
  throw new RouteConfigError(`Invalid HTTP method: ${method}`);
}

function pathParams(path: string): string[] {
  const out: string[] = [];
  const re = /\{([a-zA-Z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) out.push(m[1]!);
  return out;
}

export function collectManifest(controllers: Function[]): ManifestIR {
  const controllerIRs: ControllerIR[] = [];

  for (const ctor of controllers) {
    const cmeta = readControllerMeta(ctor);
    if (!cmeta) throw new RouteConfigError(`Missing @Controller metadata on ${ctor.name}`);

    const stubs = readRouteStubs(ctor);

    const routes: RouteIR[] = stubs.map((s: RouteStub) => {
      const fullPath = joinPaths(cmeta.basePath, s.path);
      const method = canonicalMethod(s.method);

      const handlerName = s.handlerName;
      if (!handlerName || typeof handlerName !== 'string') {
        throw new RouteConfigError(`Route handlerName must be a string on ${ctor.name}`);
      }

      // Schema rules
      const tokens = pathParams(fullPath);
      const paramsRequired = tokens.length > 0;
      const bodyRequired = method === 'POST' || method === 'PUT' || method === 'PATCH';

      const params = s.schemas.params as SchemaRef | undefined;
      const query = s.schemas.query as SchemaRef | undefined;
      const body = s.schemas.body as SchemaRef | undefined;
      const response = s.schemas.response as SchemaRef | undefined;

      if (paramsRequired && !params)
        throw new RouteConfigError(`${method} ${fullPath}: params schema required`);
      if (!query)
        throw new RouteConfigError(
          `${method} ${fullPath}: query schema required (use an empty schema)`
        );
      if (bodyRequired && !body)
        throw new RouteConfigError(`${method} ${fullPath}: body schema required`);
      if (!response) throw new RouteConfigError(`${method} ${fullPath}: response schema required`);

      return {
        controller: ctor,
        method,
        path: fullPath,
        handlerName,
        schemas: { params, query, body, response },
        includePolicy: s.includePolicy,
        guards: s.guards ?? [],
      };
    });

    controllerIRs.push({
      controller: ctor,
      basePath: normalizeSlashes(cmeta.basePath),
      tags: cmeta.tags,
      routes,
    });
  }

  // Duplicate detection (method+path)
  const seen = new Set<string>();
  for (const c of controllerIRs) {
    for (const r of c.routes) {
      const k = `${r.method} ${r.path}`;
      if (seen.has(k)) throw new RouteConfigError(`Duplicate route: ${k}`);
      seen.add(k);
    }
  }

  const allRoutes = controllerIRs.flatMap((c) => c.routes);
  return { controllers: controllerIRs, routes: allRoutes };
}
