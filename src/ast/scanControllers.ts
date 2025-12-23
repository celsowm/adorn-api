/**
 * Scan for controllers in the codebase using ts-morph
 */

import { Project } from 'ts-morph';
import path from 'node:path';
import type { Config } from '../config/types.js';
import '../polyfills/symbol-metadata.js';

export interface ControllerInfo {
  className: string;
  filePath: string;
  path: string;
  methods: MethodInfo[];
}

export interface MethodInfo {
  methodName: string;
  httpMethod: string;
  path: string;
  statusCode?: number;
  dtoName?: string;
  pathParams?: string[];
}

export async function scanControllers(config: Config): Promise<ControllerInfo[]> {
  const project = new Project({
    tsConfigFilePath: path.join(config.generation.rootDir, config.generation.tsConfigPath),
  });

  const controllers: ControllerInfo[] = [];

  for (const pattern of config.generation.controllers.include) {
    const globPath = path.join(config.generation.rootDir, pattern);
    const sourceFiles = project.addSourceFilesAtPaths(globPath);

    for (const sourceFile of sourceFiles) {
      const classes = sourceFile.getClasses();

      for (const classDeclaration of classes) {
        // Check if this class has a Controller decorator
        const hasControllerDecorator = classDeclaration.getDecorators().some(d =>
          d.getName() === 'Controller'
        );

        if (!hasControllerDecorator) continue;

        // Get controller path from decorator
        const controllerDecorator = classDeclaration.getDecorators().find(d => d.getName() === 'Controller');
        const controllerPathArg = controllerDecorator?.getArguments()[0];
        let controllerPath = '';
        
        if (controllerPathArg) {
          controllerPath = controllerPathArg.getText().replace(/['"]/g, '');
        }

        // Scan methods for routes
        const methods: MethodInfo[] = [];
        const methodDeclarations = classDeclaration.getMethods();

        for (const methodDeclaration of methodDeclarations) {
          const routeDecorator = methodDeclaration.getDecorators().find(d =>
            ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options'].includes(d.getName() || '')
          );

          if (!routeDecorator) continue;

          const httpMethod = routeDecorator.getName()!.toLowerCase();
          const routePathArg = routeDecorator.getArguments()[0];
          let routePath = '';
          
          if (routePathArg) {
            routePath = routePathArg.getText().replace(/['"]/g, '');
          }

          // Check for Status decorator
          const statusDecorator = methodDeclaration.getDecorators().find(d => d.getName() === 'Status');
          let statusCode: number | undefined;
          if (statusDecorator) {
            const statusArg = statusDecorator.getArguments()[0];
            if (statusArg) {
              statusCode = parseInt(statusArg.getText());
            }
          }

          // Check if method has a DTO parameter (first parameter)
          const parameters = methodDeclaration.getParameters();
          let dtoName: string | undefined;
          let pathParams: string[] = [];

          if (parameters.length > 0 && parameters[0]) {
            const firstParam = parameters[0];
            const paramType = firstParam.getType();
            if (paramType.isClass()) {
              dtoName = paramType.getSymbol()?.getName();
            }

            // Extract path parameters from route path if inference is enabled
            if (config.generation.inference.inferPathParamsFromTemplate) {
              const pathMatch = routePath.match(/\{([^}]+)\}/g);
              if (pathMatch) {
                pathParams = pathMatch.map(p => p.slice(1, -1));
              }
            }
          }

          const methodInfo: MethodInfo = {
            methodName: methodDeclaration.getName(),
            httpMethod,
            path: routePath,
          };

          if (dtoName !== undefined) {
            methodInfo.dtoName = dtoName;
          }

          if (pathParams.length > 0) {
            methodInfo.pathParams = pathParams;
          }

          if (statusCode !== undefined) {
            methodInfo.statusCode = statusCode;
          }

          methods.push(methodInfo);
        }

        controllers.push({
          className: classDeclaration.getName() || '',
          filePath: sourceFile.getFilePath(),
          path: controllerPath,
          methods,
        });
      }
    }
  }

  return controllers;
}
