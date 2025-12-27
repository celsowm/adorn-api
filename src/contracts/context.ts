export type RequestContext = {
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;

  method: string;
  path: string;

  raw?: unknown;
};
