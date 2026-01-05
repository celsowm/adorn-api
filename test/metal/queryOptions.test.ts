import { describe, it, expectTypeOf } from "vitest";
import type { QueryOptions } from "../../src/metal/queryOptions.js";

type Post = {
    id: number;
    title: string;
    status: string;
};

describe("adorn-api/metal QueryOptions", () => {
    it("includes where and sort but NOT pagination by default", () => {
        type PostOptions = QueryOptions<Post>;

        expectTypeOf<keyof PostOptions>().toEqualTypeOf<"where" | "sort">();
        expectTypeOf<PostOptions["where"]>().not.toBeUndefined();
        expectTypeOf<PostOptions["sort"]>().not.toBeUndefined();

        // Explicitly check that pagination fields are NOT present
        // @ts-expect-error
        type HasPage = PostOptions["page"];
        // @ts-expect-error
        type HasPageSize = PostOptions["pageSize"];
    });

    it("allows string or array for sort", () => {
        type PostOptions = QueryOptions<Post>;
        expectTypeOf<PostOptions["sort"]>().toEqualTypeOf<string | string[] | undefined>();
    });
});
