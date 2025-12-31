// .adorn/validators.mjs (generated)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cjs = require("./validators.cjs");

export const validators = cjs.validators;

export function validateBody(operationId, data) {
  const v = validators?.[operationId]?.body;
  if (!v) return { ok: true, errors: null };
  const ok = v(data);
  return { ok, errors: ok ? null : v.errors };
}

export function validateResponse(operationId, status, contentType, data) {
  const key = String(status) + "|" + String(contentType);
  const v = validators?.[operationId]?.response?.[key];
  if (!v) return { ok: true, errors: null };
  const ok = v(data);
  return { ok, errors: ok ? null : v.errors };
}
