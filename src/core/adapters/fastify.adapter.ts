// src/core/adapters/fastify.adapter.ts
// Fastify framework adapter implementation

import type { FrameworkAdapter, RequestContext, ResponseBuilder } from '../types.js';

class FastifyRequestContext implements RequestContext {
  public request: any;
  public response: any;
  public params: Record<string, any>;
  public query: Record<string, any>;
  public headers: Record<string, any>;
  public cookies: Record<string, any>;
  public body: any;
  public files?: Record<string, any>;

  constructor(req: any, reply: any) {
    this.request = req;
    this.response = reply;
    this.params = req.params || {};
    this.query = req.query || {};
    this.headers = req.headers || {};
    this.cookies = req.cookies || {};
    this.body = req.body || {};
    this.files = (req as any).files || {};
  }
}

class FastifyResponseBuilder implements ResponseBuilder {
  private reply: any;

  constructor(reply: any) {
    this.reply = reply;
  }

  status(code: number): ResponseBuilder {
    this.reply.code(code);
    return this;
  }

  json(data: any): void {
    this.reply.send(data);
  }

  send(data: any): void {
    this.reply.send(data);
  }

  end(): void {
    this.reply.send();
  }

  header(name: string, value: string): ResponseBuilder {
    this.reply.header(name, value);
    return this;
  }
}

export const fastifyAdapter: FrameworkAdapter = {
  name: 'fastify',
  
  extractRequest(req: any): RequestContext {
    return new FastifyRequestContext(req, null);
  },
  
  createResponseBuilder(res: any): ResponseBuilder {
    return new FastifyResponseBuilder(res);
  },
  
  applyMiddleware(
    req: any,
    res: any,
    next: (err?: any) => void,
    middleware: any[]
  ): void {
    // Fastify uses hooks and preHandler, not middleware arrays
    // For compatibility, we'll execute the middleware functions in sequence
    let index = 0;
    
    const run = async (err?: any) => {
      if (err || index >= middleware.length) {
        return next(err);
      }
      
      const mw = middleware[index++];
      
      try {
        // Wrap Express-style middleware to work with Fastify
        const result = mw(req, res, run);
        
        // Check if middleware returned a value (some Fastify middlewares do this)
        if (result && result.then) {
          await result;
        }
      } catch (e) {
        return next(e);
      }
    };
    
    run();
  }
};
