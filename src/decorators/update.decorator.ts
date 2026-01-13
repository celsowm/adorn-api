import { metadataStorage } from "../metadata/metadata-storage.js";
import { updateDtoToOpenApiSchema } from "metal-orm";

type UpdateOptions = {
  entity?: any;
  schema?: any;
};

function parseUpdateOptions(
  pathOrOptions?: string | UpdateOptions,
  options?: UpdateOptions,
): { path: string; options: UpdateOptions | undefined } {
  let path = "";
  let opts: UpdateOptions | undefined;

  if (typeof pathOrOptions === "string") {
    path = pathOrOptions;
    opts = options;
  } else if (typeof pathOrOptions === "object") {
    opts = pathOrOptions;
  }

  return { path, options: opts };
}

export function Update(
  pathOrOptions?: string | UpdateOptions,
  options?: UpdateOptions,
) {
  return function (
    _originalMethod: Function,
    _context: ClassMethodDecoratorContext,
  ): void {
    if (_context.kind !== "method") return;

    const methodName = String(_context.name);
    const parsed = parseUpdateOptions(pathOrOptions, options);

    let schema: any;

    if (parsed.options?.entity) {
      schema = updateDtoToOpenApiSchema(parsed.options.entity);
    } else if (parsed.options?.schema) {
      schema = parsed.options.schema;
    }

    metadataStorage.addRoute(_context.constructor, {
      path: parsed.path,
      method: "PUT",
      handlerName: methodName,
      middlewares: [],
      guards: [],
      parameters: [],
      entity: parsed.options?.entity,
      schema,
    });
  };
}
