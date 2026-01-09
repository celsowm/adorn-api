import { mergeMethodMeta } from '../metadata/collector.js';
import type { HttpMethod, RequestBodyMeta } from '../metadata/types.js';

export interface RouteOptions {
  summary?: string;
  tags?: string[];
  deprecated?: boolean;
  requestBody?: boolean | RequestBodyMeta;
}

const createRouteDecorator = (method: HttpMethod) => {
  return (path: string, options: RouteOptions = {}) => {
    return (_value: unknown, context: ClassMethodDecoratorContext): void => {
      mergeMethodMeta(context, {
        method,
        path,
        summary: options.summary,
        tags: options.tags,
        deprecated: options.deprecated,
        requestBody: options.requestBody
      });
    };
  };
};

export const Route = (method: HttpMethod, path: string, options: RouteOptions = {}) =>
  createRouteDecorator(method)(path, options);

export const Get = createRouteDecorator('get');
export const Post = createRouteDecorator('post');
export const Put = createRouteDecorator('put');
export const Patch = createRouteDecorator('patch');
export const Delete = createRouteDecorator('delete');
export const Options = createRouteDecorator('options');
export const Head = createRouteDecorator('head');
