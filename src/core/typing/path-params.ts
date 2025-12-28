export type ExtractPathParams<S extends string> =
  S extends `${string}{${infer P}}${infer Rest}`
    ? P | ExtractPathParams<Rest>
    : never;
