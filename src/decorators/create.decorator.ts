import { metadataStorage } from "../metadata/metadata-storage.js";
import { createDtoToOpenApiSchema } from "metal-orm";

type CreateOptions = {
  entity?: any;
  schema?: any;
};

function parseCreateOptions(
  pathOrOptions?: string | CreateOptions,
  options?: CreateOptions,
): { path: string; options: CreateOptions } {
  let path = "";
  let opts: CreateOptions | undefined;

  if (typeof pathOrOptions === "string") {
    path = pathOrOptions;
    opts = options;
  } else if (typeof pathOrOptions === "object") {
    opts = pathOrOptions;
  }

  return { path, options: opts || {} };
}

export function Create(
  pathOrOptions?: string | CreateOptions,
  options?: CreateOptions,
) {
  return function (
    _originalMethod: Function,
    _context: ClassMethodDecoratorContext,
  ): void {
    if (_context.kind !== "method") return;

    const methodName = String(_context.name);
    const parsed = parseCreateOptions(pathOrOptions, options);

    let schema: any;

    if (parsed.options?.entity) {
      schema = createDtoToOpenApiSchema(parsed.options.entity);
    } else if (parsed.options?.schema) {
      schema = parsed.options.schema;
    }

    metadataStorage.addRoute(_context.constructor, {
      path: parsed.path,
      method: "POST",
      handlerName: methodName,
      middlewares: [],
      guards: [],
      parameters: [],
      entity: parsed.options?.entity,
      schema,
    });
  };
}
