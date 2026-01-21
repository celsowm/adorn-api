import { Dto, Field } from "../../core/decorators";
import type { DtoConstructor } from "../../core/types";

import { t } from "../../core/schema";
import type { FieldMeta } from "../../core/metadata";
import { registerDto } from "../../core/metadata";
import type {
  PagedQueryDtoOptions,
  PagedResponseDtoOptions,
  PagedFilterQueryDtoOptions
} from "./types";

export function createPagedQueryDtoClass(
  options: PagedQueryDtoOptions = {}
): DtoConstructor {
  const { defaultPageSize = 25, maxPageSize = 100 } = options;

  @Dto({ name: options.name })
  class PagedQueryDto {
    @Field(t.optional(t.integer({ minimum: 1, default: 1 })))
    page?: number;

    @Field(
      t.optional(
        t.integer({ minimum: 1, maximum: maxPageSize, default: defaultPageSize })
      )
    )
    pageSize?: number;
  }

  return PagedQueryDto;
}

export function createPagedFilterQueryDtoClass(
  options: PagedFilterQueryDtoOptions
): DtoConstructor {
  const { filters, defaultPageSize = 25, maxPageSize = 100, name } = options;

  const PagedFilterQueryDto = class {
    page?: number;
    pageSize?: number;
    [key: string]: any;
  };

  const fields: Record<string, FieldMeta> = {
    page: { schema: t.optional(t.integer({ minimum: 1, default: 1 })), optional: true },
    pageSize: { schema: t.optional(t.integer({ minimum: 1, maximum: maxPageSize, default: defaultPageSize })), optional: true }
  };

  for (const [fieldName, def] of Object.entries(filters)) {
    const schema = def.schema ?? t.string({ minLength: 1 });
    fields[fieldName] = { schema: t.optional(schema), optional: true };
  }

  registerDto(PagedFilterQueryDto, {
    name: name ?? "PagedFilterQueryDto",
    fields
  });

  return PagedFilterQueryDto as DtoConstructor;
}

export function createPagedResponseDtoClass(
  options: PagedResponseDtoOptions
): DtoConstructor {
  const { itemDto, description, name } = options;
  const responseDescription = description ?? "Paged response.";

  @Dto({ name, description: responseDescription })
  class PagedResponseDto {
    @Field(t.array(t.ref(itemDto)))
    items!: unknown[];

    @Field(t.integer({ minimum: 0 }))
    totalItems!: number;

    @Field(t.integer({ minimum: 1 }))
    page!: number;

    @Field(t.integer({ minimum: 1 }))
    pageSize!: number;

    @Field(t.integer({ minimum: 1 }))
    totalPages!: number;

    @Field(t.boolean())
    hasNextPage!: boolean;

    @Field(t.boolean())
    hasPrevPage!: boolean;
  }

  return PagedResponseDto;
}
