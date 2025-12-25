import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDecoratorMetadata } from '../runtime/metadataPolyfill.js';
import { loadControllersFromModule } from './loadControllers.js';
import { generateOpenApi } from '../openapi/generate.js';

ensureDecoratorMetadata();

function parseArgs(argv: string[]): { entry: string; out?: string } {
  const args = argv.slice(2);
  const entry = args[0];
  if (!entry) {
    // eslint-disable-next-line no-undef
    console.error('Usage: openapi <entry-module> [--out ./openapi.json]');
    // eslint-disable-next-line no-undef
    process.exit(1);
  }
  const outIndex = args.indexOf('--out');
  const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
  return { entry, out };
}

// eslint-disable-next-line no-undef
const { entry, out } = parseArgs(process.argv);
// eslint-disable-next-line no-undef
const entryAbs = entry.startsWith('file:') ? entry : resolve(process.cwd(), entry);

const controllers = await loadControllersFromModule(entryAbs);
const spec = generateOpenApi(controllers, { title: 'adorn-api', version: '0.0.1' });

const json = JSON.stringify(spec, null, 2);
if (out) {
  // eslint-disable-next-line no-undef
  writeFileSync(resolve(process.cwd(), out), json, 'utf-8');
  // eslint-disable-next-line no-undef
  console.log(`Wrote OpenAPI to ${out}`);
} else {
  // eslint-disable-next-line no-undef
  console.log(json);
}
