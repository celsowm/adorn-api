/**
 * Metal ORM decorator metadata utilities.
 * Provides functions to read and manage entity decorator metadata.
 */
import { ensureSymbolMetadata } from "./symbolMetadata.js";

/**
 * Symbol key for storing Metal ORM decorator metadata.
 */
export const METAL_METADATA_KEY = "metal-orm:decorators";

/**
 * Represents a column definition in Metal ORM entity metadata.
 */
export type MetalColumnDef = {
  /** Database column type (e.g., "varchar", "int", "timestamp") */
  type: string;
  /** Additional type arguments (e.g., length for varchar) */
  args?: unknown[];
  /** Database dialect-specific type definitions */
  dialectTypes?: unknown;
  /** Whether the column is NOT NULL */
  notNull?: boolean;
  /** Whether this is a primary key column */
  primary?: boolean;
  /** TypeScript type override for the column */
  tsType?: unknown;
  /** Whether the column has a unique constraint */
  unique?: boolean;
  /** Default value for the column */
  default?: unknown;
  /** Whether the column auto-increments */
  autoIncrement?: boolean;
  /** How the column value is generated (e.g., "byDefault", "always") */
  generated?: unknown;
  /** CHECK constraint for the column */
  check?: unknown;
  /** Foreign key references */
  references?: unknown;
  /** Column comment/description */
  comment?: string;
};

/**
 * Represents relation metadata in a Metal ORM entity.
 */
export type MetalRelationMetadata = {
  /** Type of relation (e.g., "hasMany", "belongsTo") */
  kind: string;
  /** Property name of the relation */
  propertyKey: string;
  /** Target entity constructor (optional, may be a getter) */
  target?: (...args: any[]) => any;
};

/**
 * Container for all decorator metadata of a Metal ORM entity.
 */
export type MetalDecoratorBag = {
  /** Array of column definitions */
  columns: Array<{ propertyName: string; column: MetalColumnDef }>;
  /** Array of relation metadata */
  relations: Array<{ propertyName: string; relation: MetalRelationMetadata }>;
};

/**
 * Reads Metal ORM decorator metadata from a class constructor.
 * 
 * @param ctor - The class constructor to read metadata from
 * @returns The decorator bag if metadata exists, undefined otherwise
 */
export function readMetalDecoratorBagFromConstructor(ctor: object): MetalDecoratorBag | undefined {
  const metadataSymbol = ensureSymbolMetadata();
  const metadata = Reflect.get(ctor, metadataSymbol) as Record<PropertyKey, unknown> | undefined;
  return metadata?.[METAL_METADATA_KEY] as MetalDecoratorBag | undefined;
}
