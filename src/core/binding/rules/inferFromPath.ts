export function getPathTokenNames(template: string): string[] {
  const out: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) out.push(String(m[1]));
  return out;
}
