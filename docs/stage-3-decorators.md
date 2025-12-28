# Stage-3 decorators + TS config

Adorn uses the standard (Stage-3) decorator metadata model based on `Symbol.metadata`.

Requirements:
- Node.js 18+
- TypeScript 5.2+ (this repo tracks 5.9.x)

Minimal `tsconfig.json` snippet:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "emitDecoratorMetadata": false,
    "useDefineForClassFields": true
  }
}
```

Notes:
- Keep `emitDecoratorMetadata` off; Adorn does not rely on it.
- Do not enable `experimentalDecorators`; that switches back to legacy decorators.
- If you use a custom build chain, ensure it preserves standard decorator metadata.

Legacy vs Stage-3:
- Legacy decorators (`experimentalDecorators: true`) use the old emit behavior and do not provide `Symbol.metadata`.
- Stage-3 decorators (TypeScript 5.x default) use `Symbol.metadata`, which Adorn reads at runtime.
