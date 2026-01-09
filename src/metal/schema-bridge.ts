export const mergeOpenApiComponents = (
  ...components: Array<Record<string, unknown> | undefined>
): Record<string, unknown> => {
  const result: Record<string, unknown> = { schemas: {} };
  for (const component of components) {
    if (!component) continue;
    for (const [key, value] of Object.entries(component)) {
      if (key === 'schemas' && typeof value === 'object' && value) {
        result.schemas = { ...(result.schemas as Record<string, unknown>), ...(value as Record<string, unknown>) };
        continue;
      }
      result[key] = value;
    }
  }
  return result;
};
