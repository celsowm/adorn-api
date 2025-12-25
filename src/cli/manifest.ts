import { ensureDecoratorMetadata } from '../runtime/metadataPolyfill.js';
import { loadControllersFromModule } from './loadControllers.js';
import { collectManifest } from '../core/ir.js';
import { resolve } from 'node:path';

ensureDecoratorMetadata();

function parseArgs(argv: string[]): { entry: string } {
  const args = argv.slice(2);
  const entry = args[0];
  if (!entry) {
    // eslint-disable-next-line no-undef
    console.error('Usage: manifest <entry-module>');
    // eslint-disable-next-line no-undef
    process.exit(1);
  }
  return { entry };
}

// eslint-disable-next-line no-undef
const { entry } = parseArgs(process.argv);
// eslint-disable-next-line no-undef
const entryAbs = entry.startsWith('file:') ? entry : resolve(process.cwd(), entry);

const controllers = await loadControllersFromModule(entryAbs);
const manifest = collectManifest(controllers);
// eslint-disable-next-line no-undef
console.log(JSON.stringify(manifest, null, 2));
