import { ensureSymbolMetadata } from "./symbolMetadata.js";

export const METAL_METADATA_KEY = "metal-orm:decorators";

export type MetalColumnDef = {
  type: string;
  args?: unknown[];
  dialectTypes?: unknown;
  notNull?: boolean;
  primary?: boolean;
  tsType?: unknown;
  unique?: boolean;
  default?: unknown;
  autoIncrement?: boolean;
  generated?: unknown;
  check?: unknown;
  references?: unknown;
  comment?: string;
};

export type MetalRelationMetadata = {
  kind: string;
  propertyKey: string;
  target?: (...args: any[]) => any;
};

export type MetalDecoratorBag = {
  columns: Array<{ propertyName: string; column: MetalColumnDef }>;
  relations: Array<{ propertyName: string; relation: MetalRelationMetadata }>;
};

export function readMetalDecoratorBagFromConstructor(ctor: object): MetalDecoratorBag | undefined {
  const metadataSymbol = ensureSymbolMetadata();
  const metadata = Reflect.get(ctor, metadataSymbol) as Record<PropertyKey, unknown> | undefined;
  return metadata?.[METAL_METADATA_KEY] as MetalDecoratorBag | undefined;
}
