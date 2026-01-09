export type PaginationInput = {
  page?: unknown;
  pageSize?: unknown;
};

export type PaginationOptions = {
  defaultPage?: number;
  defaultPageSize?: number;
  minPage?: number;
  minPageSize?: number;
  maxPageSize?: number;
};

const toInt = (value: unknown, fallback: number): number => {
  const parsed =
    typeof value === 'number'
      ? Math.trunc(value)
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizePagination = (
  input: PaginationInput,
  options: PaginationOptions = {}
): { page: number; pageSize: number } => {
  const defaultPage = options.defaultPage ?? 1;
  const defaultPageSize = options.defaultPageSize ?? 10;
  const minPage = options.minPage ?? 1;
  const minPageSize = options.minPageSize ?? 1;
  const maxPageSize = options.maxPageSize ?? Number.POSITIVE_INFINITY;

  const page = Math.max(minPage, toInt(input.page, defaultPage));
  let pageSize = Math.max(minPageSize, toInt(input.pageSize, defaultPageSize));
  if (Number.isFinite(maxPageSize)) {
    pageSize = Math.min(maxPageSize, pageSize);
  }

  return { page, pageSize };
};
