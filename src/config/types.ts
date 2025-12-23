/**
 * Configuration types for adorn-api
 */

export interface Config {
  generation: GenerationConfig;
  swagger: SwaggerConfig;
}

export interface GenerationConfig {
  rootDir: string;
  tsConfigPath: string;
  controllers: {
    include: string[];
  };
  basePath: string;
  framework: 'express';
  outputs: {
    routes: string;
    openapi: string;
  };
  inference: {
    inferPathParamsFromTemplate: boolean;
    defaultDtoFieldSource: 'smart' | 'body' | 'query';
    collisionPolicy: 'path-wins' | 'query-wins';
  };
}

export interface SwaggerConfig {
  enabled: boolean;
  info: {
    title: string;
    version: string;
  };
}

export interface LoadConfigOptions {
  configPath?: string;
}
