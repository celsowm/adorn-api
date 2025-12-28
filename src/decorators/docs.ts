import { META, type DocsMeta } from '../metadata/keys.js';
import { bagEnsureObject, bagFromContext } from '../metadata/bag.js';
import type { RouteOptions } from '../contracts/route-options.js';

type Stage3ClassContext = ClassDecoratorContext;
type Stage3MethodContext = ClassMethodDecoratorContext<any, (this: any, ...args: any) => any>;
type DecoratorContext = Stage3ClassContext | Stage3MethodContext;
type RouteDocs = Partial<RouteOptions<string>>;

function ensureDocsMeta(context: DecoratorContext): DocsMeta {
  const bag = bagFromContext(context);
  return bagEnsureObject<DocsMeta>(bag, META.docs, () => ({}));
}

function ensureMethodDocs(meta: DocsMeta, method: string): RouteDocs {
  meta.byMethod ??= {};
  meta.byMethod[method] ??= {};
  return meta.byMethod[method] as RouteDocs;
}

function mergeTags(existing: string[] | undefined, next: string[]): string[] {
  return [...(existing ?? []), ...next];
}

export function Tags(...tags: string[]) {
  return function (_value: Function, context: DecoratorContext) {
    const meta = ensureDocsMeta(context);
    const cleaned = tags.map((t) => t.trim()).filter(Boolean);
    if (!cleaned.length) return;

    if (context.kind === 'class') {
      meta.tags = mergeTags(meta.tags, cleaned);
      return;
    }

    const method = String(context.name);
    const methodDocs = ensureMethodDocs(meta, method);
    methodDocs.tags = mergeTags(methodDocs.tags, cleaned);
  };
}

export function OperationId(id: string) {
  return function (_value: Function, context: Stage3MethodContext) {
    const meta = ensureDocsMeta(context);
    const method = String(context.name);
    const methodDocs = ensureMethodDocs(meta, method);
    methodDocs.operationId = id;
  };
}

export function Deprecated(value = true) {
  return function (_value: Function, context: Stage3MethodContext) {
    const meta = ensureDocsMeta(context);
    const method = String(context.name);
    const methodDocs = ensureMethodDocs(meta, method);
    methodDocs.deprecated = value;
  };
}
