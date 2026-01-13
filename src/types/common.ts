export type PlainObject = Record<string, any>;

export type Constructor<T = any> = new (...args: any[]) => T;

export type MaybePromise<T> = T | Promise<T>;
