import type * as ts from 'typescript';
import type { PluginConfig } from '../contracts.js';
import { scanProgram } from '../analysis/scanProgram.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

type TransformerExtras = {
  ts: typeof ts;
  addDiagnostic?: (d: ts.Diagnostic) => void;
};

export default function transform(
  program: ts.Program,
  pluginConfig: PluginConfig,
  extras: TransformerExtras,
): ts.TransformerFactory<ts.SourceFile> {
  const tsi = extras.ts;
  const routes = scanProgram(tsi, program, pluginConfig);

  if (pluginConfig.emitAnalysisFile) {
    mkdirSync(dirname(pluginConfig.emitAnalysisFile), { recursive: true });
    writeFileSync(pluginConfig.emitAnalysisFile, JSON.stringify({ routes }, null, 2), 'utf8');
  }

  if (extras.addDiagnostic) {
    extras.addDiagnostic({
      category: tsi.DiagnosticCategory.Message,
      code: 90001,
      file: undefined,
      start: undefined,
      length: undefined,
      messageText: `[adorn-api] discovered ${routes.length} decorated route(s)`,
    });
  }

  return (_ctx) => (sf) => sf;
}
