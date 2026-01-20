/**
 * Generic constructor type.
 */
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * DTO constructor type.
 */
export type DtoConstructor<T = any> = new (...args: any[]) => T;

/**
 * HTTP method types.
 */
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
