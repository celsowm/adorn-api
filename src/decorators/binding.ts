/**
 * Property decorators for DTO validation
 */

import '../polyfills/symbol-metadata.js';
import { DTO_PROPERTY_KEY } from '../meta/keys.js';
import type { DtoPropertyMetadata } from '../meta/types.js';

function createPropertyDecorator(type: DtoPropertyMetadata['type'], required: boolean = true) {
  return function (
    _value: undefined,
    context: ClassFieldDecoratorContext
  ) {
    if (context.metadata) {
      if (!context.metadata[DTO_PROPERTY_KEY]) {
        context.metadata[DTO_PROPERTY_KEY] = new Map<string | symbol, DtoPropertyMetadata>();
      }
      if (type) {
        (context.metadata[DTO_PROPERTY_KEY] as Map<string | symbol, DtoPropertyMetadata>).set(context.name, { type, required });
      }
    }
  };
}

export function IsString() {
  return createPropertyDecorator('string');
}

export function IsNumber() {
  return createPropertyDecorator('number');
}

export function IsBoolean() {
  return createPropertyDecorator('boolean');
}

export function IsDate() {
  return createPropertyDecorator('date');
}

export function Optional() {
  return function (
    _value: undefined,
    context: ClassFieldDecoratorContext
  ) {
    if (context.metadata) {
      if (!context.metadata[DTO_PROPERTY_KEY]) {
        context.metadata[DTO_PROPERTY_KEY] = new Map<string | symbol, DtoPropertyMetadata>();
      }
      const map = context.metadata[DTO_PROPERTY_KEY] as Map<string | symbol, DtoPropertyMetadata>;
      const existing = map.get(context.name) || { required: true };
      map.set(context.name, { ...existing, required: false });
    }
  };
}
