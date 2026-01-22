import type { Request, Response, NextFunction, Express } from "express";
import type { CorsOptions } from "./types";

/**
 * Attaches CORS middleware to an Express application.
 * @param app - Express application instance
 * @param options - CORS options
 */
export function attachCors(app: Express, options: CorsOptions = {}): void {
  const methods = options.methods ?? ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"];
  const allowedHeaders = options.allowedHeaders ?? ["Content-Type", "Authorization"];
  const maxAge = options.maxAge ?? 86400;

  const resolveOrigin = (requestOrigin: string | undefined): string | false => {
    const origin = options.origin ?? "*";

    if (origin === "*") {
      return options.credentials ? (requestOrigin ?? "*") : "*";
    }

    if (typeof origin === "string") {
      return origin === requestOrigin ? origin : false;
    }

    if (Array.isArray(origin)) {
      return requestOrigin && origin.includes(requestOrigin) ? requestOrigin : false;
    }

    if (typeof origin === "function") {
      const result = origin(requestOrigin);
      if (typeof result === "string") {
        return result;
      }
      return result && requestOrigin ? requestOrigin : false;
    }

    return false;
  };

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestOrigin = req.headers.origin;
    const allowedOrigin = resolveOrigin(requestOrigin);

    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    }

    if (options.credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    if (options.exposedHeaders?.length) {
      res.setHeader("Access-Control-Expose-Headers", options.exposedHeaders.join(", "));
    }

    if (allowedOrigin !== "*" && requestOrigin) {
      res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
      res.setHeader("Access-Control-Allow-Headers", allowedHeaders.join(", "));
      res.setHeader("Access-Control-Max-Age", String(maxAge));
      res.status(204).end();
      return;
    }

    next();
  });
}
