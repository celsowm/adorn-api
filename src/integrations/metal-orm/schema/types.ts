export type HttpScalar<T> =
  T extends Date ? string :
  T extends bigint ? number :
  T;

export type HttpPick<T, K extends keyof T> = HttpScalar<T[K]>;

export type Paged = {
  page?: number;
  pageSize?: number;
};
