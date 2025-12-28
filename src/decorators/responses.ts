import { META, type DocsMeta } from '../metadata/keys.js';
import { bagEnsureObject, bagFromContext } from '../metadata/bag.js';
import type { ResponseSpec, ResponsesSpec } from '../contracts/responses.js';
import type { Schema } from '../validation/native/schema.js';

type Stage3MethodContext = ClassMethodDecoratorContext<any, (this: any, ...args: any) => any>;

function ensureDocsMeta(context: Stage3MethodContext): DocsMeta {
  const bag = bagFromContext(context);
  return bagEnsureObject<DocsMeta>(bag, META.docs, () => ({}));
}

function ensureResponses(meta: DocsMeta, method: string): ResponsesSpec {
  meta.byMethod ??= {};
  meta.byMethod[method] ??= {};
  const existing = meta.byMethod[method] as { responses?: ResponsesSpec };
  if (!existing.responses) existing.responses = {};
  return existing.responses;
}

function isSchema(value: unknown): value is Schema<any> {
  return !!value && typeof value === 'object' && typeof (value as { parse?: unknown }).parse === 'function';
}

export function Responses(spec: ResponsesSpec) {
  return function (_value: Function, context: Stage3MethodContext) {
    const meta = ensureDocsMeta(context);
    const method = String(context.name);
    const responses = ensureResponses(meta, method);

    Object.assign(responses, spec);
  };
}

export function Response(
  status: number | string,
  spec?: ResponseSpec | Schema<any> | string,
) {
  return function (_value: Function, context: Stage3MethodContext) {
    const meta = ensureDocsMeta(context);
    const method = String(context.name);
    const responses = ensureResponses(meta, method);

    let value: ResponseSpec | Schema<any>;
    if (typeof spec === 'string') {
      value = { description: spec };
    } else if (spec && isSchema(spec)) {
      value = spec;
    } else {
      value = spec ?? {};
    }

    responses[String(status)] = value;
  };
}
