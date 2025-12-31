import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { ErrorObject } from "ajv";

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[] | null;
}

export class ValidationErrorResponse extends Error {
  constructor(
    public statusCode: number,
    public errors: ValidationError[]
  ) {
    super("Validation failed");
    this.name = "ValidationErrorResponse";
  }
}

export function createValidator() {
  const ajv = new Ajv.default({
    allErrors: true,
    coerceTypes: false,
    strict: false,
    validateFormats: true,
  });

  addFormats.default(ajv);

  ajv.addFormat("br-phone", /^\(\d{2}\)\s\d{5}-\d{4}$/);

  return ajv;
}

export function validateData(
  ajv: ReturnType<typeof createValidator>,
  data: unknown,
  schema: Record<string, unknown>,
  dataPath: string = "#"
): ValidationResult {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    return { valid: true, errors: null };
  }

  const errors: ValidationError[] = (validate.errors || []).map((err: ErrorObject) => ({
    path: formatErrorPath(dataPath, err),
    message: err.message || "Invalid value",
    keyword: err.keyword,
    params: err.params as Record<string, unknown>,
  }));

  return { valid: false, errors };
}

function formatErrorPath(basePath: string, err: ErrorObject): string {
  const instancePath = err.instancePath;

  if (!instancePath || instancePath === "") {
    return basePath;
  }

  if (basePath === "#" || basePath.endsWith("/")) {
    return `${basePath}${instancePath.slice(1)}`;
  }

  return `${basePath}${instancePath}`;
}

export function formatValidationErrors(errors: ValidationError[]): Record<string, unknown> {
  const formatted: Record<string, string[]> = {};

  for (const error of errors) {
    const path = error.path || "body";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(error.message);
  }

  return {
    error: "Validation failed",
    details: formatted,
  };
}
