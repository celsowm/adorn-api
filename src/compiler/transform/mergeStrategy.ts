export function mergeStrategy(target: unknown, patch: unknown) {
  return { ...target as object, ...(patch as object) };
}
