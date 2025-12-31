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

interface DecoratorMetadata {
  [ADORN_META]?: HttpMetadata;
}

function getMetadata(target: Object): HttpMetadata {
  const metadata = (target as DecoratorMetadata)[ADORN_META] ?? {};
  (target as DecoratorMetadata)[ADORN_META] = metadata;
  return metadata;
}

export type QueryStyle = QueryStyleOptions;

export function QueryStyle(options: QueryStyleOptions): ParameterDecorator {
  return function (_target: Object, _propertyKey: string | symbol, _parameterIndex: number): void {
    const metadata = getMetadata(_target);
    metadata.queryStyles ??= {};
    metadata.queryStyles[_propertyKey.toString()] = options;
  } as ParameterDecorator;
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

export type Cookies<T = any> = T;

export { ADORN_META };
export type { HttpMetadata, QueryStyleOptions, FilePartOptions };
