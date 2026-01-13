import type { OpenAPIV3_1 } from 'openapi-types';

export interface OpenApiOptions {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
  components?: OpenAPIV3_1.ComponentsObject;
}

export type OpenApiSpec = {
  openapi: '3.1.0';
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths?: Record<string, OpenAPIV3_1.PathItemObject>;
  components?: OpenAPIV3_1.ComponentsObject;
  tags?: OpenAPIV3_1.TagObject[];
  servers?: OpenAPIV3_1.ServerObject[];
} & Omit<OpenAPIV3_1.Document, 'openapi' | 'info' | 'paths' | 'components' | 'tags' | 'servers'>;
