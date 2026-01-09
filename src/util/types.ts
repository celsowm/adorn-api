export type Constructor<T = object> = new (...args: any[]) => T;

export type AnyRecord = Record<string, unknown>;
