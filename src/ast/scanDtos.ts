/**
 * Scan for DTOs in the codebase using ts-morph
 */

import { Project, ClassDeclaration, Type } from 'ts-morph';
import path from 'node:path';
import type { Config } from '../config/types.js';

export interface DtoInfo {
  name: string;
  properties: DtoPropertyInfo[];
}

export interface DtoPropertyInfo {
  name: string;
  type: string;
  required: boolean;
  isArray: boolean;
  isNullable: boolean;
}

export async function scanDtos(config: Config, dtoNames: string[]): Promise<DtoInfo[]> {
  const project = new Project({
    tsConfigFilePath: path.join(config.generation.rootDir, config.generation.tsConfigPath),
  });

  const dtos: DtoInfo[] = [];
  const processedDtos = new Set<string>();

  for (const pattern of config.generation.controllers.include) {
    const globPath = path.join(config.generation.rootDir, pattern);
    const sourceFiles = project.addSourceFilesAtPaths(globPath);

    for (const sourceFile of sourceFiles) {
      const classes = sourceFile.getClasses();

      for (const classDeclaration of classes) {
        const className = classDeclaration.getName();
        if (className && dtoNames.includes(className) && !processedDtos.has(className)) {
          dtos.push(extractDtoInfo(classDeclaration));
          processedDtos.add(className);
        }
      }
    }
  }

  return dtos;
}

function extractDtoInfo(classDeclaration: ClassDeclaration): DtoInfo {
  const properties: DtoPropertyInfo[] = [];

  for (const property of classDeclaration.getProperties()) {
    const name = property.getName();
    const type = property.getType();
    
    // Check if it's optional (? or has Optional decorator)
    const isOptional = property.hasQuestionToken() || 
      property.getDecorators().some(d => d.getName() === 'Optional');
    
    properties.push({
      name,
      type: type.getText(),
      required: !isOptional,
      isArray: type.isArray(),
      isNullable: type.isNullable(),
    });
  }

  return {
    name: classDeclaration.getName() || 'AnonymousDto',
    properties,
  };
}
