import { metadataStorage } from '../metadata/metadata-storage.js';

export interface ValidationSchema {
  validate(value: any): boolean | Promise<boolean>;
  getErrors?(value: any): string[] | Promise<string[]>;
}

export function ValidateBody(schema: ValidationSchema) {
  return function (
    originalMethod: Function,
    context: ClassMethodDecoratorContext & { kind: 'method' }
  ): Function | void {
    if (context.kind === 'method') {
      metadataStorage.addPendingMiddleware(
        originalMethod,
        async (req: any, _res: any, next: any) => {
          const isValid = await schema.validate(req.body);
          if (!isValid) {
            const errors = schema.getErrors
              ? await schema.getErrors(req.body)
              : ['Validation failed'];
            return _res.status(400).json({ errors });
          }
          next();
        }
      );

      return originalMethod;
    }
  };
}

export function ValidateParams(schema: ValidationSchema) {
  return function (
    originalMethod: Function,
    context: ClassMethodDecoratorContext & { kind: 'method' }
  ): Function | void {
    if (context.kind === 'method') {
      metadataStorage.addPendingMiddleware(
        originalMethod,
        async (req: any, _res: any, next: any) => {
          const isValid = await schema.validate(req.params);
          if (!isValid) {
            const errors = schema.getErrors
              ? await schema.getErrors(req.params)
              : ['Validation failed'];
            return _res.status(400).json({ errors });
          }
          next();
        }
      );

      return originalMethod;
    }
  };
}
