import { pathToFileURL } from 'node:url';

export async function loadControllersFromModule(modulePath: string): Promise<Function[]> {
  const url = modulePath.startsWith('file:') ? modulePath : pathToFileURL(modulePath).href;

  const mod = await import(url);

  // Convention: export const controllers = [A, B]
  if (Array.isArray((mod as any).controllers)) return (mod as any).controllers as Function[];

  // Convention: default export controller class
  if (typeof (mod as any).default === 'function') return [(mod as any).default as Function];

  throw new Error(
    'No controllers found: export `controllers` array or default controller class from the entry module.'
  );
}
