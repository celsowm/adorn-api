import { Dto, Field } from "../../core/decorators";
import type { DtoConstructor } from "../../core/types";
import type { ErrorDtoOptions } from "./types";
import { t } from "../../core/schema";

export function createErrorDtoClass(options: ErrorDtoOptions = {}): DtoConstructor {
  const { withDetails = true, includeTraceId = true } = options;

  if (withDetails) {
    @Dto()
    class ErrorDetailDto {
      @Field(t.string())
      field!: string;

      @Field(t.string())
      message!: string;
    }

    @Dto()
    class ErrorDto {
      @Field(t.string())
      message!: string;

      @Field(t.optional(t.string()))
      code?: string;

      @Field(t.optional(t.array(t.ref(ErrorDetailDto))))
      errors?: ErrorDetailDto[];

      @Field(t.optional(t.string()))
      traceId?: string;
    }

    return ErrorDto;
  }

  @Dto()
  class SimpleErrorDto {
    @Field(t.string())
    message!: string;

    @Field(t.optional(t.string()))
    traceId?: string;
  }

  return SimpleErrorDto;
}

export const StandardErrorDto = createErrorDtoClass({ withDetails: true, includeTraceId: true });
export const SimpleErrorDto = createErrorDtoClass({ withDetails: false, includeTraceId: true });
export const BasicErrorDto = createErrorDtoClass({ withDetails: false, includeTraceId: false });
