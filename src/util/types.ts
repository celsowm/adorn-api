export type Constructor<T = object> = new (...args: any[]) => T;

export type AnyRecord = Record<string, unknown>;

export type EntitySummary<T, K extends keyof T> = Pick<T, K>;

export type SummaryOf<T, K extends readonly (keyof T)[]> = Pick<T, K[number]>;

export const summaryKeys =
  <T>() =>
  <K extends readonly (keyof T)[]>(...keys: K) =>
    keys;
