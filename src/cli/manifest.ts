import { ensureDecoratorMetadata } from "../runtime/metadataPolyfill.js";
import { loadControllersFromModule } from "./loadControllers.js";
import { collectManifest } from "../core/ir.js";
import { resolve } from "node:path";

ensureDecoratorMetadata();

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const entry = args[0];
  if (!entry) {
    console.error("Usage: manifest <entry-module>");
    process.exit(1);
  }
  return { entry };
}

const { entry } = parseArgs(process.argv);
const entryAbs = entry.startsWith("file:") ? entry : resolve(process.cwd(), entry);

const controllers = await loadControllersFromModule(entryAbs);
const manifest = collectManifest(controllers);
console.log(JSON.stringify(manifest, null, 2));
