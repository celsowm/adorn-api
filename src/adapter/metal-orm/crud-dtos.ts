import { Dto } from "../../core/decorators";
import type { DtoConstructor } from "../../core/types";
import { MetalDto } from "./dto";
import type {
  MetalCrudDtoOptions,
  MetalCrudDtoClassOptions,
  MetalCrudDtoClasses,
  MetalCrudDtoDecorators,
  NestedCreateDtoOptions
} from "./types";

export function createMetalCrudDtos(
  target: any,
  options: MetalCrudDtoOptions = {}
): MetalCrudDtoDecorators {
  const mutationExclude = options.mutationExclude;
  const immutable = options.immutable;

  const response = buildCrudOptions(options.response, options.overrides);
  const create = buildCrudOptions(options.create, options.overrides, {
    mode: "create",
    exclude: mergeStringArrays(mutationExclude, options.create?.exclude)
  });
  const replace = buildCrudOptions(options.replace, options.overrides, {
    mode: "create",
    exclude: mergeStringArrays(mutationExclude, immutable, options.replace?.exclude)
  });
  const update = buildCrudOptions(options.update, options.overrides, {
    mode: "update",
    exclude: mergeStringArrays(mutationExclude, immutable, options.update?.exclude)
  });

  const params = buildCrudOptions(options.params, options.overrides);
  params.include = params.include ?? options.paramsInclude ?? ["id"];

  return {
    response: MetalDto(target, response),
    create: MetalDto(target, create),
    replace: MetalDto(target, replace),
    update: MetalDto(target, update),
    params: MetalDto(target, params)
  };
}

export function createMetalCrudDtoClasses(
  target: any,
  options: MetalCrudDtoClassOptions = {}
): MetalCrudDtoClasses {
  const { baseName, names, ...crudOptions } = options;
  const decorators = createMetalCrudDtos(target, crudOptions);
  const entityName = baseName ?? getTargetName(target);
  const defaultNames: Record<keyof MetalCrudDtoDecorators, string> = {
    response: `${entityName}Dto`,
    create: `Create${entityName}Dto`,
    replace: `Replace${entityName}Dto`,
    update: `Update${entityName}Dto`,
    params: `${entityName}ParamsDto`
  };

  const classes: Partial<MetalCrudDtoClasses> = {};
  for (const key of Object.keys(decorators) as Array<keyof MetalCrudDtoDecorators>) {
    const name = names?.[key] ?? defaultNames[key];
    classes[key] = buildDtoClass(name, decorators[key]);
  }
  return classes as MetalCrudDtoClasses;
}

export function createNestedCreateDtoClass(
  target: any,
  overrides: Record<string, any>,
  options: NestedCreateDtoOptions
): DtoConstructor {
  const { additionalExclude, name, parentEntity, ...metalDtoOptions } = options;

  const allExcludes = mergeStringArrays(
    ["id", "createdAt"],
    additionalExclude,
    metalDtoOptions.exclude
  );

  @MetalDto(target, {
    ...metalDtoOptions,
    mode: "create",
    exclude: allExcludes,
    overrides
  })
  class NestedCreateDto {}

  Object.defineProperty(NestedCreateDto, "name", { value: name, configurable: true });

  return NestedCreateDto;
}

function buildDtoClass(name: string, decorator: (target: DtoConstructor) => void): DtoConstructor {
  const DtoClass = class {};
  Object.defineProperty(DtoClass, "name", { value: name, configurable: true });
  decorator(DtoClass);
  return DtoClass;
}

function getTargetName(target: any): string {
  if (typeof target === "function" && target.name) {
    return target.name;
  }
  return "Entity";
}

function mergeOverrides(
  base?: Record<string, any>,
  override?: Record<string, any>
): Record<string, any> | undefined {
  if (!base && !override) {
    return undefined;
  }
  return { ...(base ?? {}), ...(override ?? {}) };
}

function mergeStringArrays(
  ...entries: Array<string[] | undefined>
): string[] | undefined {
  const merged = new Set<string>();
  for (const entry of entries) {
    for (const value of entry ?? []) {
      merged.add(value);
    }
  }
  return merged.size ? Array.from(merged) : undefined;
}

function buildCrudOptions(
  base: any | undefined,
  overrides: Record<string, any> | undefined,
  extra: any = {}
): any {
  const mergedOverrides = mergeOverrides(overrides, base?.overrides);
  const output: any = { ...base, ...extra };
  if (mergedOverrides) {
    output.overrides = mergedOverrides;
  }
  return output;
}
