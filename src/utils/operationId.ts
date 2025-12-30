export function defaultOperationId(controllerName: string, methodName: string): string {
  return `${controllerName}_${methodName}`;
}
