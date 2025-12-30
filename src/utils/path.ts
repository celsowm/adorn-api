export function joinPaths(base: string, sub: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const s = sub.startsWith("/") ? sub : `/${sub}`;
  return (b + s) || "/";
}
