/**
 * Load configuration from a file
 */

import { pathToFileURL } from 'node:url';
import type { Config, LoadConfigOptions } from './types.js';

export async function loadConfig(options: LoadConfigOptions = {}): Promise<Config> {
  const configPath = options.configPath || './adorn.config.ts';
  
  // Import the config file
  const configModule = await import(pathToFileURL(configPath).href);
  const config = configModule.default;
  
  return config as Config;
}
