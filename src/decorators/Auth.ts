import { getBucket } from "../runtime/metadata/bucket.js";
import type { HttpMethod } from "../runtime/metadata/types.js";

/**
 * Decorator to mark a method as requiring authentication.
 * 
 * @param scheme - The authentication scheme to use (e.g., "Bearer", "Basic")
 * @param options - Optional authentication configuration
 * @param options.scopes - Required permission scopes for this endpoint
 * @param options.optional - If true, authentication is optional (useful for mixed auth endpoints)
 * 
 * @example
 * ```ts
 * @Auth("Bearer", { scopes: ["admin"] })
 * @Delete("/users/:id")
 * deleteUser() {
 *   // Implementation
 * }
 * ```
 */
export function Auth(scheme: string, options?: { scopes?: string[]; optional?: boolean }) {
  return function (
    target: any,
    context: ClassMethodDecoratorContext
  ) {
    if (context.kind !== "method") {
      throw new Error("@Auth decorator can only be applied to methods");
    }

    const methodName = String(context.name);
    const bucket = getBucket(context.metadata);
    let op = bucket.ops.find(op => op.methodName === methodName);
    if (!op) {
      op = {
        httpMethod: "GET" as HttpMethod,
        path: "/",
        methodName,
      };
      bucket.ops.push(op);
    }

    op.auth = {
      scheme,
      scopes: options?.scopes,
      optional: options?.optional ?? false,
    };
  };
}
