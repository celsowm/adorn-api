/**
 * Generate OpenAPI specification
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Config } from '../config/types.js';
import { scanControllers } from '../ast/scanControllers.js';
import { emitOpenapiJson } from './emitJson.js';

export async function generateOpenapi(config: Config): Promise<void> {
  // Scan for controllers
  const controllers = await scanControllers(config);

  // Generate OpenAPI spec
  const openapi = emitOpenapiJson(config, controllers);

  // Write to output file
  const outputPath = path.join(config.generation.rootDir, config.generation.outputs.openapi);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(openapi, null, 2), 'utf-8');
}
