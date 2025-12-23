/**
 * Controller decorator - marks a class as a controller
 */

import '../polyfills/symbol-metadata.js';
import { CONTROLLER_KEY } from '../meta/keys.js';
import type { ControllerMetadata } from '../meta/types.js';

export function Controller(path: string) {
  return function <T extends abstract new (...args: any[]) => any>(
    target: T,
    context: ClassDecoratorContext
  ): T | void {
    // Using standard Stage 3 decorator metadata API
    const metadata = context.metadata;
    metadata[CONTROLLER_KEY] = { path } as ControllerMetadata;
  };
}
