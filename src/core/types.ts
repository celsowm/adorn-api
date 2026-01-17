export type Constructor<T = any> = new (...args: any[]) => T;
export type DtoConstructor<T = any> = new (...args: any[]) => T;

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";
