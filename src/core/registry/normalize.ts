export function normalizePath(p: string): string {
  let out = (p ?? '').trim();
  if (!out) return '';
  if (!out.startsWith('/')) out = `/${out}`;

  out = out.replace(/\/{2,}/g, '/');

  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

export function joinPaths(basePath: string, routePath: string): string {
  const a = normalizePath(basePath);
  const b = normalizePath(routePath);

  if (!a && !b) return '/';
  if (!a) return b || '/';
  if (!b || b === '/') return a || '/';

  const joined = `${a}${b.startsWith('/') ? '' : '/'}${b}`;
  return normalizePath(joined);
}
