// src/lib/load-config.ts
// Configuration loader that merges user config with defaults

import path from 'path';
import type { AdornConfig } from '../core/config.js';
import { DEFAULT_CONFIG } from '../core/config.js';

const DEFAULT_CONFIG_PATH = './adorn.config.ts';

export async function loadConfig(configPath?: string): Promise<AdornConfig> {
  const filePath = configPath || DEFAULT_CONFIG_PATH;
  const absolutePath = path.resolve(process.cwd(), filePath);

  try {
    const module = await import(`${absolutePath}?t=${Date.now()}`);
    const userConfig = module.default || module.config || {};
    return mergeConfig(userConfig);
  } catch (error) {
    throw new Error(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function mergeConfig(userConfig: Partial<AdornConfig>): AdornConfig {
  const defaults = DEFAULT_CONFIG;

  const merged: AdornConfig = {
    generation: {
      ...defaults.generation,
      ...userConfig.generation,
    } as AdornConfig['generation'],
    runtime: {
      ...defaults.runtime,
      ...userConfig.runtime,
    } as AdornConfig['runtime'],
    swagger: {
      ...defaults.swagger,
      ...userConfig.swagger,
      info: {
        ...defaults.swagger?.info,
        ...userConfig.swagger?.info,
      },
    } as AdornConfig['swagger'],
  };

  return merged;
}
