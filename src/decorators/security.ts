import { META, type DocsMeta, type SecurityMeta } from '../metadata/keys.js';
import { bagEnsureObject, bagFromContext } from '../metadata/bag.js';
import type { SecurityRequirementObject, SecuritySchemeObject } from '../contracts/openapi-v3.js';
import type { RouteOptions } from '../contracts/route-options.js';

type Stage3ClassContext = ClassDecoratorContext;
type Stage3MethodContext = ClassMethodDecoratorContext<any, (this: any, ...args: any) => any>;
type DecoratorContext = Stage3ClassContext | Stage3MethodContext;

function ensureDocsMeta(context: DecoratorContext): DocsMeta {
  const bag = bagFromContext(context);
  return bagEnsureObject<DocsMeta>(bag, META.docs, () => ({}));
}

function ensureSecurityTarget(meta: DocsMeta, context: DecoratorContext): Partial<RouteOptions<string>> {
  if (context.kind === 'class') return meta;

  const method = String(context.name);
  meta.byMethod ??= {};
  meta.byMethod[method] ??= {};
  return meta.byMethod[method] as Partial<RouteOptions<string>>;
}

function normalizeRequirements(
  nameOrReq: string | SecurityRequirementObject | SecurityRequirementObject[],
  scopes?: string[],
): SecurityRequirementObject[] {
  if (typeof nameOrReq === 'string') {
    return [{ [nameOrReq]: scopes ?? [] }];
  }

  if (Array.isArray(nameOrReq)) return nameOrReq;
  return [nameOrReq];
}

export function Security(
  nameOrReq: string | SecurityRequirementObject | SecurityRequirementObject[],
  scopes?: string[],
) {
  return function (_value: Function, context: DecoratorContext) {
    const meta = ensureDocsMeta(context);
    const target = ensureSecurityTarget(meta, context);
    const next = normalizeRequirements(nameOrReq, scopes);

    target.security = [...(target.security ?? []), ...next];
  };
}

export function SecurityScheme(name: string, scheme: SecuritySchemeObject) {
  return function (_value: Function, context: Stage3ClassContext) {
    const bag = bagFromContext(context);
    const meta = bagEnsureObject<SecurityMeta>(bag, META.security, () => ({}));

    meta.schemes ??= {};
    meta.schemes[name] = scheme;
  };
}
