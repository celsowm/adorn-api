// src/lib/load-config.ts
// Phase 4: Configuration loader - Breaking changes

import { promises as fs } from 'fs';
import path from 'path';
import type { AdornConfig, DEFAULT_CONFIG } from '../core/config.js';

const DEFAULT_CONFIG_PATH = './adorn.config.ts';

export async function loadConfig(configPath?: string): Promise<AdornConfig> {
  const filePath = configPath || DEFAULT_CONFIG_PATH;
  const absolutePath = path.resolve(process.cwd(), filePath);
  
  try {
    // Read config file
    const configContent = await fs.readFile(absolutePath, 'utf-8');
    
    // For now, we'll eval the config to get the default export
    // In production, we'd use a proper config loader
    // This is a simplified approach for Phase 4
    const module = await import(`${absolutePath}?t=${Date.now()}`);
    const userConfig = module.default || module.config || {};
    
    // Merge with defaults
    return mergeConfig(userConfig);
  } catch (error) {
    throw new Error(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function mergeConfig(userConfig: any): AdornConfig {
  const defaults: any = {
    generation: {
      rootDir: process.cwd(),
      tsConfig: './tsconfig.json',
      controllersGlob: '**/*.controller.ts',
      basePath: '',
      framework: 'express',
    },
    runtime: {
      validationEnabled: false,
      useClassInstantiation: false,
    },
    swagger: {
      enabled: true,
      outputPath: './swagger.json',
      info: {
        title: 'API Documentation',
        version: '1.0.0',
      },
    },
  };
  
  // Deep merge
  return {
    generation: { ...defaults.generation, ...userConfig.generation },
    runtime: { ...defaults.runtime, ...userConfig.runtime },
    swagger: { ...defaults.swagger, ...userConfig.swagger, info: { ...defaults.swagger.info, ...userConfig.swagger?.info } },
  };
}
