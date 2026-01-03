import { describe, it, expectTypeOf } from "vitest";
import type { HasManyCollection, HasOneReference } from "metal-orm";
import type { SearchWhere } from "../../src/metal/searchWhere.js";

type Profile = {
  id: number;
  bio: string;
};

type Author = {
  id: number;
  name: string;
  profile?: HasOneReference<Profile>;
};

type Comment = {
  id: number;
  body: string;
};

type Post = {
  id: number;
  title: string;
  views?: number | null;
  author?: HasOneReference<Author>;
  comments?: HasManyCollection<Comment>;
  meta?: {
    featured: boolean;
    flags?: string[];
  };
};

type DefaultWhere = SearchWhere<Post>;
type Depth1Where = SearchWhere<Post, { maxDepth: 1 }>;
type IncludeTitleWhere = SearchWhere<Post, { include: ["title"] }>;
type IncludeAuthorIdWhere = SearchWhere<Post, { include: ["author.id"] }>;
type WithMetaWhere = SearchWhere<Post, { relations: ["meta"] }>;

describe("adorn-api/metal searchWhere", () => {
  it("includes scalar keys and relation wrappers by default", () => {
    expectTypeOf<Extract<keyof DefaultWhere, "id">>().toEqualTypeOf<"id">();
    expectTypeOf<Extract<keyof DefaultWhere, "title">>().toEqualTypeOf<"title">();
    expectTypeOf<Extract<keyof DefaultWhere, "views">>().toEqualTypeOf<"views">();
    expectTypeOf<Extract<keyof DefaultWhere, "author">>().toEqualTypeOf<"author">();
    expectTypeOf<Extract<keyof DefaultWhere, "comments">>().toEqualTypeOf<"comments">();
    expectTypeOf<Extract<keyof DefaultWhere, "meta">>().toEqualTypeOf<never>();
  });

  it("respects maxDepth for nested relations", () => {
    type Depth1Author = NonNullable<Depth1Where["author"]>;
    expectTypeOf<Extract<keyof Depth1Author, "id">>().toEqualTypeOf<"id">();
    expectTypeOf<Extract<keyof Depth1Author, "name">>().toEqualTypeOf<"name">();
    expectTypeOf<Extract<keyof Depth1Author, "profile">>().toEqualTypeOf<never>();
  });

  it("honors include paths for scalars and descendants", () => {
    expectTypeOf<Extract<keyof IncludeTitleWhere, "title">>().toEqualTypeOf<"title">();
    expectTypeOf<Extract<keyof IncludeTitleWhere, "id">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<keyof IncludeTitleWhere, "author">>().toEqualTypeOf<never>();

    type IncludeAuthorId = NonNullable<IncludeAuthorIdWhere["author"]>;
    expectTypeOf<Extract<keyof IncludeAuthorId, "id">>().toEqualTypeOf<"id">();
    expectTypeOf<Extract<keyof IncludeAuthorId, "name">>().toEqualTypeOf<never>();
  });

  it("allows relation overrides for object properties", () => {
    expectTypeOf<Extract<keyof WithMetaWhere, "meta">>().toEqualTypeOf<"meta">();
    type MetaWhere = NonNullable<WithMetaWhere["meta"]>;
    expectTypeOf<Extract<keyof MetaWhere, "featured">>().toEqualTypeOf<"featured">();
    expectTypeOf<Extract<keyof MetaWhere, "flags">>().toEqualTypeOf<never>();
  });
});
