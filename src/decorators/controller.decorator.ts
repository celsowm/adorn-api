import type { ControllerMetadata } from "../types/metadata.js";
import { metadataStorage } from "../metadata/metadata-storage.js";
import { attachPendingRoutesToController } from "./http-method.decorator.js";
import { attachPendingListRoutesToController } from "./list.decorator.js";

export function Controller(path: string) {
  return function (value: Function, context: ClassDecoratorContext): void {
    if (context.kind === "class") {
      const metadata: ControllerMetadata = {
        path,
        middlewares: [],
        guards: [],
      };

      metadataStorage.setController(value, metadata);

      context.addInitializer(() => {
        attachPendingRoutesToController(value);
        attachPendingListRoutesToController(value);
      });
    }
  };
}
