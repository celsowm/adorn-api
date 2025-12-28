export type SchemaIR =
  | { kind: 'string'; minLength?: number; maxLength?: number; format?: 'email' | 'uuid' | 'date-time'; pattern?: string; enum?: string[] }
  | { kind: 'number'; int?: boolean; min?: number; max?: number }
  | { kind: 'boolean' }
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'array'; items: SchemaIR; minItems?: number; maxItems?: number }
  | { kind: 'object'; properties: Record<string, SchemaIR>; required: string[]; strict?: boolean }
  | { kind: 'union'; anyOf: SchemaIR[] }
  | { kind: 'nullable'; inner: SchemaIR }
  | { kind: 'optional'; inner: SchemaIR };
