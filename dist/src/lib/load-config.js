// src/lib/load-config.ts
// Configuration loader that merges user config with defaults
import path from 'path';
import { DEFAULT_CONFIG } from '../core/config.js';
const DEFAULT_CONFIG_PATH = './adorn.config.ts';
export async function loadConfig(configPath) {
    const filePath = configPath || DEFAULT_CONFIG_PATH;
    const absolutePath = path.resolve(process.cwd(), filePath);
    try {
        // Handle Windows paths by converting to file:// URL
        const fileUrl = process.platform === 'win32'
            ? `file:///${absolutePath.replace(/\\/g, '/')}`
            : absolutePath;
        const module = await import(`${fileUrl}?t=${Date.now()}`);
        const userConfig = module.default || module.config || {};
        return mergeConfig(userConfig);
    }
    catch (error) {
        throw new Error(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function mergeConfig(userConfig) {
    const defaults = DEFAULT_CONFIG;
    const merged = {
        generation: {
            ...defaults.generation,
            ...userConfig.generation,
        },
        runtime: {
            ...defaults.runtime,
            ...userConfig.runtime,
        },
        swagger: {
            ...defaults.swagger,
            ...userConfig.swagger,
            info: {
                ...defaults.swagger?.info,
                ...userConfig.swagger?.info,
            },
        },
    };
    return merged;
}
