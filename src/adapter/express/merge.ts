import type { ManifestV1, OperationEntry } from "../../compiler/manifest/format.js";
import { readAdornBucket } from "../../runtime/metadata/read.js";
import { defaultOperationId } from "../../utils/operationId.js";
import { joinPaths } from "../../utils/path.js";

export interface BoundRoute {
  operationId: string;
  fullPath: string;
  httpMethod: OperationEntry["http"]["method"];
  controllerCtor: new (...args: any[]) => any;
  methodName: string;
  args: OperationEntry["args"];
  responses: OperationEntry["responses"];
}

export function bindRoutes(params: {
  controllers: Array<new (...args: any[]) => any>;
  manifest: ManifestV1;
}): BoundRoute[] {
  const { controllers, manifest } = params;

  const manifestByOpId = new Map<string, OperationEntry>();
  for (const ctrl of manifest.controllers) {
    for (const op of ctrl.operations) {
      if (manifestByOpId.has(op.operationId)) {
        throw new Error(`Duplicate operationId in manifest: ${op.operationId}`);
      }
      manifestByOpId.set(op.operationId, op);
    }
  }

  const bound: BoundRoute[] = [];

  for (const ctor of controllers) {
    const bucket = readAdornBucket(ctor);
    if (!bucket) {
      console.warn(`No decorator metadata found for ${ctor.name}, skipping`);
      continue;
    }

    const basePath = bucket.basePath ?? "/";

    for (const routeOp of bucket.ops) {
      const opId = routeOp.operationId ?? defaultOperationId(ctor.name, routeOp.methodName);

      const manifestOp = manifestByOpId.get(opId);
      if (!manifestOp) {
        throw new Error(
          `No manifest entry for operationId="${opId}. ` +
          `Did you run "adorn-api build"? Are your operationId rules aligned?`
        );
      }

      if (manifestOp.http.method !== routeOp.httpMethod || manifestOp.http.path !== routeOp.path) {
        throw new Error(
          `Route mismatch for ${opId}. ` +
          `Runtime: ${routeOp.httpMethod} ${routeOp.path}, ` +
          `Manifest: ${manifestOp.http.method} ${manifestOp.http.path}. ` +
          `Rebuild with "adorn-api build".`
        );
      }

      const fullPath = joinPaths(basePath, routeOp.path);

      bound.push({
        operationId: opId,
        fullPath,
        httpMethod: manifestOp.http.method,
        controllerCtor: ctor,
        methodName: routeOp.methodName,
        args: manifestOp.args,
        responses: manifestOp.responses,
      });
    }
  }

  return bound;
}
