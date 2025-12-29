import type { ResponseSpec, ResponsesSpec } from '../../contracts/responses.js';
import type { Schema } from '../../validation/native/schema.js';

function isSchema(value: unknown): value is Schema<unknown> {
  const candidate = value as Schema<unknown>;
  return typeof candidate?.parse === 'function';
}

export function normalizeResponses(input?: ResponsesSpec): Record<string, ResponseSpec> {
  if (!input) return {};

  const out: Record<string, ResponseSpec> = {};

  for (const [status, spec] of Object.entries(input)) {
    if (isSchema(spec)) {
      out[status] = {
        content: {
          'application/json': {
            schema: spec,
          },
        },
      };
      continue;
    }

    const normalized: ResponseSpec = { ...spec };
    if (normalized.schema && !normalized.content) {
      normalized.content = {
        'application/json': {
          schema: normalized.schema,
        },
      };
      delete normalized.schema;
    }

    out[status] = normalized;
  }

  return out;
}
