import "./runtime/polyfill.js";

const ADORN_META = Symbol.for("adorn-api.metadata");

interface HttpMetadata {
  consumes?: string[];
  produces?: string[];
  queryStyles?: Record<string, QueryStyleOptions>;
  fileParts?: Record<string, FilePartOptions>;
  cookies?: Record<string, boolean>;
}

interface QueryStyleOptions {
  style?: "form" | "spaceDelimited" | "pipeDelimited" | "deepObject";
  explode?: boolean;
  allowReserved?: boolean;
}

interface FilePartOptions {
  contentType?: string;
  headers?: Record<string, string>;
}

type DecoratorMetadata = Record<PropertyKey, unknown> & { [ADORN_META]?: HttpMetadata };

function getMetadata(target: Object | DecoratorMetadata): HttpMetadata {
  const host = target as DecoratorMetadata;
  const metadata = host[ADORN_META] ?? {};
  host[ADORN_META] = metadata;
  return metadata;
}

export type QueryStyle = QueryStyleOptions;

export function QueryStyle(options: QueryStyleOptions) {
  return function <T extends (...args: any[]) => any>(
    _target: T,
    context: ClassMethodDecoratorContext<any, T>
  ): void {
    if (context.private || context.static) return;
    const metadata = getMetadata(context.metadata);
    metadata.queryStyles ??= {};
    metadata.queryStyles[String(context.name)] = options;
  };
}

export type PartType = FilePartOptions;

export function PartType(contentTypeOrOptions: string | FilePartOptions): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    const metadata = getMetadata(target);
    const options: FilePartOptions = typeof contentTypeOrOptions === "string"
      ? { contentType: contentTypeOrOptions }
      : contentTypeOrOptions;
    metadata.fileParts ??= {};
    metadata.fileParts[propertyKey.toString()] = options;
  };
}

export function File(): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    const metadata = getMetadata(target);
    metadata.fileParts ??= {};
    metadata.fileParts[propertyKey.toString()] = metadata.fileParts[propertyKey.toString()] ?? {};
  };
}

export function Consumes(...contentTypes: string[]): ClassDecorator {
  return function (target: Function): void {
    const metadata = getMetadata(target.prototype);
    metadata.consumes = contentTypes;
  };
}

export function Produces(...contentTypes: string[]): ClassDecorator {
  return function (target: Function): void {
    const metadata = getMetadata(target.prototype);
    metadata.produces = contentTypes;
  };
}

export type Query<T = any> = T;
export type Body<T = any> = T;
export type Headers<T = any> = T;
export type Cookies<T = any> = T;

export { ADORN_META };
export type { HttpMetadata, QueryStyleOptions, FilePartOptions };
