import type {
  PagedQueryParams,
  PaginationQueryParams,
  SortDirection,
  SortingQueryParams
} from "../../src/index";

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type _SortDirectionMatchesPublicType = Assert<
  IsEqual<SortingQueryParams["sortDirection"], SortDirection | undefined>
>;

const paginationOnly: PaginationQueryParams = {
  page: 1,
  pageSize: 25
};

const sortingOnly: SortingQueryParams = {
  sortBy: "createdAt",
  sortDirection: "desc"
};

const pagedWithSorting: PagedQueryParams = {
  page: paginationOnly.page,
  pageSize: paginationOnly.pageSize,
  sortBy: sortingOnly.sortBy,
  sortDirection: "asc"
};

// @ts-expect-error sortDirection accepts only "asc" | "desc"
const invalidSorting: SortingQueryParams = { sortDirection: "ASC" };

void paginationOnly;
void sortingOnly;
void pagedWithSorting;
void invalidSorting;
