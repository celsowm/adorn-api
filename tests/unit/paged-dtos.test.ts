import { describe, expect, it } from "vitest";
import {
  createPagedQueryDtoClass,
  createPagedResponseDtoClass
} from "../../src/adapter/metal-orm/index";
import { getDtoMeta } from "../../src/core/metadata";

describe("createPagedQueryDtoClass", () => {
  it("creates DTO with pagination fields", () => {
    const PagedQueryDto = createPagedQueryDtoClass();
    expect(PagedQueryDto.name).toBe("PagedQueryDto");
  });

  it("applies custom defaults", () => {
    const PagedQueryDto = createPagedQueryDtoClass({
      defaultPageSize: 50,
      maxPageSize: 200
    });
    expect(PagedQueryDto.name).toBe("PagedQueryDto");
  });

  it("uses custom name when provided", () => {
    const PagedQueryDto = createPagedQueryDtoClass({
      name: "UserPagedQueryDto"
    });
    const meta = getDtoMeta(PagedQueryDto);
    expect(meta?.name).toBe("UserPagedQueryDto");
  });
});

describe("createPagedResponseDtoClass", () => {
  it("creates DTO with pagination fields", () => {
    class ItemDto {}

    const PagedResponseDto = createPagedResponseDtoClass({
      itemDto: ItemDto as any,
      description: "Test response"
    });

    expect(PagedResponseDto.name).toBe("PagedResponseDto");
  });

  it("uses custom name when provided", () => {
    class ItemDto {}

    const PagedResponseDto = createPagedResponseDtoClass({
      itemDto: ItemDto as any,
      name: "UserPagedResponseDto"
    });

    const meta = getDtoMeta(PagedResponseDto);
    expect(meta?.name).toBe("UserPagedResponseDto");
  });
});
