import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDecoratorMetadata } from '../runtime/metadataPolyfill.js';
import { loadControllersFromModule } from './loadControllers.js';
import { generateOpenApi } from '../openapi/generate.js';

ensureDecoratorMetadata();

function usage(message?: string): never {
  if (message) {
    // eslint-disable-next-line no-undef
    console.error(`Error: ${message}`);
  }
  // eslint-disable-next-line no-undef
  console.error('Usage: openapi <entry-module> [--out <output-file>]');
  // eslint-disable-next-line no-undef
  process.exit(1);
}

function parseArgs(argv: string[]): { entry: string; out?: string } {
  const args = argv.slice(2);
  if (!args.length) {
    usage('entry module is required');
  }

  let entry: string | undefined;
  let out: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--out') {
      const next = args[i + 1];
      if (!next) {
        usage('--out requires a file path');
      }
      out = next;
      i += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      usage();
    }

    if (!entry) {
      entry = arg;
      continue;
    }

    usage(`unexpected argument: ${arg}`);
  }

  if (!entry) {
    usage('entry module is required');
  }

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
  writeFileSync(resolve(process.cwd(), out), json, 'utf-8');
  // eslint-disable-next-line no-undef
  console.log(`OpenAPI specification written to ${out}`);
} else {
  // eslint-disable-next-line no-undef
  process.stdout.write(`${json}\n`);
}
