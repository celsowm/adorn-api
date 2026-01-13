import type { Request, Response, NextFunction } from 'express';

export class HttpParams {
  constructor(
    private req: Request,
    _res: Response,
    _next: NextFunction
  ) {}

  param(name: string): string | undefined {
    return this.req.params[name];
  }

  query(name: string): string | undefined {
    return this.req.query[name] as string | undefined;
  }

  body<T = any>(): T {
    return this.req.body as T;
  }

  header(name: string): string | undefined {
    return this.req.get(name);
  }

  all<T = any>(): T {
    return {
      ...this.req.params,
      ...this.req.query,
      ...this.req.body,
    } as T;
  }
}

export type HttpContext = {
  req: Request;
  res: Response;
  next: NextFunction;
  params: HttpParams;
};
