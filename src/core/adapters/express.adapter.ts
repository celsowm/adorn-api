// src/core/adapters/express.adapter.ts
// Express framework adapter implementation

import type { FrameworkAdapter, RequestContext, ResponseBuilder } from '../types.js';

class ExpressRequestContext implements RequestContext {
  public request: any;
  public response: any;
  public params: Record<string, any>;
  public query: Record<string, any>;
  public headers: Record<string, any>;
  public cookies: Record<string, any>;
  public body: any;
  public files?: Record<string, any>;

  constructor(req: any, res: any) {
    this.request = req;
    this.response = res;
    this.params = req.params || {};
    this.query = req.query || {};
    this.headers = req.headers || {};
    this.cookies = req.cookies || {};
    this.body = req.body || {};
    this.files = (req as any).files || {};
  }
}

class ExpressResponseBuilder implements ResponseBuilder {
  private res: any;

  constructor(res: any) {
    this.res = res;
  }

  status(code: number): ResponseBuilder {
    this.res.status(code);
    return this;
  }

  json(data: any): void {
    this.res.json(data);
  }

  send(data: any): void {
    this.res.send(data);
  }

  end(): void {
    this.res.end();
  }

  header(name: string, value: string): ResponseBuilder {
    this.res.set(name, value);
    return this;
  }
}

export const expressAdapter: FrameworkAdapter = {
  name: 'express',
  
  extractRequest(req: any): RequestContext {
    return new ExpressRequestContext(req, null);
  },
  
  createResponseBuilder(res: any): ResponseBuilder {
    return new ExpressResponseBuilder(res);
  },
  
  applyMiddleware(
    req: any,
    res: any,
    next: (err?: any) => void,
    middleware: any[]
  ): void {
    let index = 0;
    
    const run = (err?: any) => {
      if (err || index >= middleware.length) {
        return next(err);
      }
      
      const mw = middleware[index++];
      mw(req, res, run);
    };
    
    run();
  }
};
