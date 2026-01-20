import { getColumnMap } from "metal-orm";
import type { DtoConstructor } from "../../core/types";
import { registerDto } from "../../core/metadata";
import { buildFields, type MetalDtoOptions } from "./field-builder";

export type MetalDtoTarget = Parameters<typeof getColumnMap>[0];

export function MetalDto(target: MetalDtoTarget, options: MetalDtoOptions = {}) {
  return (value: DtoConstructor): void => {
    const fields = buildFields(target, options);
    registerDto(value, {
      name: options.name ?? value.name,
      description: options.description,
      fields,
      additionalProperties: options.additionalProperties
    });
  };
}

export type { MetalDtoOptions } from "./field-builder";
