import {
  Body,
  Controller,
  Delete,
  Get,
  Params,
  Patch,
  Post,
  Put,
  Query,
  Returns
} from "../../core/decorators";
import type { DtoConstructor } from "../../core/types";
import type { RequestContext } from "../express/types";
import type {
  CreateCrudControllerOptions,
  CrudControllerService,
  CrudControllerServiceInput,
  MetalCrudDtoClasses,
  RouteErrorsDecorator
} from "./types";
import { parseIdOrThrow } from "./utils";

type DtoInstance<TDto extends DtoConstructor> = InstanceType<TDto>;
type MethodDecorator = (
  value: unknown,
  context: ClassMethodDecoratorContext
) => void;

export function createCrudController<TDtos extends MetalCrudDtoClasses<any>>(
  options: CreateCrudControllerOptions<TDtos>
) {
  const withOptionsRoute = options.withOptionsRoute ?? true;
  const withReplace = options.withReplace ?? true;
  const withPatch = options.withPatch ?? true;
  const withDelete = options.withDelete ?? true;
  const service = resolveService(options.service);
  const routeErrorsDecorator = options.dtos.errors;

  @Controller({ path: options.path, tags: options.tags })
  class GeneratedCrudController {
    @Get("/")
    @Query(options.dtos.queryDto)
    @Returns(options.dtos.pagedResponseDto)
    async list(
      ctx: RequestContext<unknown, DtoInstance<TDtos["queryDto"]>>
    ): Promise<DtoInstance<TDtos["pagedResponseDto"]>> {
      return await service.list(ctx);
    }

    @when(withOptionsRoute, Get("/options"))
    @when(withOptionsRoute, Query(options.dtos.optionsQueryDto))
    @when(withOptionsRoute, Returns(options.dtos.optionsDto))
    async options(
      ctx: RequestContext<unknown, DtoInstance<TDtos["optionsQueryDto"]>>
    ): Promise<DtoInstance<TDtos["optionsDto"]>> {
      assertServiceMethod(service, "options");
      return await service.options(ctx);
    }

    @Get("/:id")
    @Params(options.dtos.params)
    @Returns(options.dtos.response)
    @applyRouteErrors(routeErrorsDecorator)
    async getById(
      ctx: RequestContext<unknown, undefined, DtoInstance<TDtos["params"]>>
    ): Promise<DtoInstance<TDtos["response"]>> {
      const id = parseContextId(ctx, options.entityName);
      return await service.getById(id, ctx);
    }

    @Post("/")
    @Body(options.dtos.create)
    @Returns({ status: 201, schema: options.dtos.response })
    async create(
      ctx: RequestContext<DtoInstance<TDtos["create"]>>
    ): Promise<DtoInstance<TDtos["response"]>> {
      return await service.create(ctx.body, ctx);
    }

    @when(withReplace, Put("/:id"))
    @when(withReplace, Params(options.dtos.params))
    @when(withReplace, Body(options.dtos.replace))
    @when(withReplace, Returns(options.dtos.response))
    @when(withReplace, applyRouteErrors(routeErrorsDecorator))
    async replace(
      ctx: RequestContext<
        DtoInstance<TDtos["replace"]>,
        undefined,
        DtoInstance<TDtos["params"]>
      >
    ): Promise<DtoInstance<TDtos["response"]>> {
      assertServiceMethod(service, "replace");
      const id = parseContextId(ctx, options.entityName);
      return await service.replace(id, ctx.body, ctx);
    }

    @when(withPatch, Patch("/:id"))
    @when(withPatch, Params(options.dtos.params))
    @when(withPatch, Body(options.dtos.update))
    @when(withPatch, Returns(options.dtos.response))
    @when(withPatch, applyRouteErrors(routeErrorsDecorator))
    async update(
      ctx: RequestContext<
        DtoInstance<TDtos["update"]>,
        undefined,
        DtoInstance<TDtos["params"]>
      >
    ): Promise<DtoInstance<TDtos["response"]>> {
      assertServiceMethod(service, "update");
      const id = parseContextId(ctx, options.entityName);
      return await service.update(id, ctx.body, ctx);
    }

    @when(withDelete, Delete("/:id"))
    @when(withDelete, Params(options.dtos.params))
    @when(withDelete, Returns({ status: 204, description: "No Content" }))
    @when(withDelete, applyRouteErrors(routeErrorsDecorator))
    async delete(
      ctx: RequestContext<unknown, undefined, DtoInstance<TDtos["params"]>>
    ): Promise<void> {
      assertServiceMethod(service, "delete");
      const id = parseContextId(ctx, options.entityName);
      await service.delete(id, ctx);
    }
  }

  Object.defineProperty(GeneratedCrudController, "name", {
    value: `${options.entityName}CrudController`,
    configurable: true
  });

  return GeneratedCrudController;
}

function resolveService<TDtos extends MetalCrudDtoClasses<any>>(
  input: CrudControllerServiceInput<TDtos>
): CrudControllerService<TDtos> {
  if (typeof input === "function") {
    return new input();
  }
  return input;
}

function when(enabled: boolean, decorator: MethodDecorator): MethodDecorator {
  return (value, context) => {
    if (enabled) {
      decorator(value, context);
    }
  };
}

function applyRouteErrors(
  decorator: RouteErrorsDecorator | undefined
): MethodDecorator {
  return (value, context) => {
    decorator?.(value, context);
  };
}

function parseContextId(
  ctx: RequestContext<unknown, undefined, object | undefined>,
  entityName: string
): number {
  const params = (ctx.params ?? {}) as Record<string, unknown>;
  return parseIdOrThrow(toIdValue(params.id), entityName);
}

function toIdValue(value: unknown): string | number {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return "";
}

function assertServiceMethod<
  TDtos extends MetalCrudDtoClasses<any>,
  TMethod extends "options" | "replace" | "update" | "delete"
>(
  service: CrudControllerService<TDtos>,
  method: TMethod
): asserts service is CrudControllerService<TDtos> & Record<TMethod, NonNullable<CrudControllerService<TDtos>[TMethod]>> {
  if (typeof service[method] !== "function") {
    throw new Error(
      `CRUD service is missing "${method}" method required by enabled route.`
    );
  }
}
