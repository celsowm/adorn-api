import type { ResponseMetadata } from "../types/metadata.js";
import { metadataStorage } from "../metadata/metadata-storage.js";

const pendingResponses = new Map<Function, ResponseMetadata>();

export function attachPendingResponsesToController(
  controllerClass: Function,
): void {
  pendingResponses.forEach((response, method) => {
    pendingResponses.delete(method);

    const routes = metadataStorage.getRoutes(controllerClass);
    const route = routes?.find(
      (r) => r.handlerName === String((method as any).name),
    );

    if (route) {
      route.response = response;
    }
  });
}

export function Response(
  status: number = 200,
  description?: string,
  schema?: any,
) {
  return function (
    originalMethod: Function,
    context: ClassMethodDecoratorContext & { kind: "method" },
  ): void {
    if (context.kind === "method") {
      const response: ResponseMetadata = {
        status,
        description,
        schema,
      };
      pendingResponses.set(originalMethod, response);
    }
  };
}

export function Header(name: string, value: string) {
  return function (
    _originalMethod: Function,
    context: ClassMethodDecoratorContext & { kind: "method" },
  ): void {
    if (context.kind === "method") {
      const methodName = String(context.name);
      const controllerClass = context.constructor;
      const routes = metadataStorage.getRoutes(controllerClass);

      const route = routes?.find((r) => r.handlerName === methodName);

      if (route) {
        if (!route.middlewares) {
          route.middlewares = [];
        }

        route.middlewares.push((_req: any, res: any, next: any) => {
          res.setHeader(name, value);
          next();
        });
      }
    }
  };
}
