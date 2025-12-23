/**
 * Controller decorator - marks a class as a controller
 */

import '../polyfills/symbol-metadata.js';
import { CONTROLLER_KEY } from '../meta/keys.js';
import type { ControllerMetadata } from '../meta/types.js';

export function Controller(path: string): ClassDecorator {
  return function <T extends new (...args: any[]) => any>(target: T): T {
    // Using standard Stage 3 decorator metadata API
    // This will be available at Symbol.metadata on the class
    const metadata = (target as any)[Symbol.metadata] || {};
    metadata[CONTROLLER_KEY] = { path } as ControllerMetadata;
    (target as any)[Symbol.metadata] = metadata;
    
    return target;
  };
}
