/**
 * Generate route registration code
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Config } from '../config/types.js';
import { scanControllers } from '../ast/scanControllers.js';
import { emitExpressRoutes } from './emit/express.js';

export async function generateRoutes(config: Config): Promise<void> {
  // Scan for controllers
  const controllers = await scanControllers(config);

  // Generate the routes code
  const routesCode = emitExpressRoutes(config, controllers);

  // Write to output file
  const outputPath = path.join(config.generation.rootDir, config.generation.outputs.routes);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, routesCode, 'utf-8');
}
