import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { UploadedFileMeta } from "../../core/metadata";
import type { MultipartOptions, UploadedFileInfo } from "./types";

/**
 * Parsed multipart file from raw request.
 */
interface ParsedFile {
  fieldName: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Normalized multipart options with defaults applied.
 */
interface NormalizedMultipartOptions {
  storage: "memory" | "disk";
  dest: string;
  maxFileSize: number;
  maxFiles: number;
}

const DEFAULT_OPTIONS: NormalizedMultipartOptions = {
  storage: "memory",
  dest: "",
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10
};

/**
 * Normalizes multipart options with defaults.
 */
export function normalizeMultipartOptions(
  options: boolean | MultipartOptions | undefined
): NormalizedMultipartOptions | undefined {
  if (!options) {
    return undefined;
  }
  if (options === true) {
    return DEFAULT_OPTIONS;
  }
  return {
    storage: options.storage ?? DEFAULT_OPTIONS.storage,
    dest: options.dest ?? DEFAULT_OPTIONS.dest,
    maxFileSize: options.maxFileSize ?? DEFAULT_OPTIONS.maxFileSize,
    maxFiles: options.maxFiles ?? DEFAULT_OPTIONS.maxFiles
  };
}

/**
 * Creates a middleware for handling multipart/form-data requests.
 * This is a simple built-in parser that doesn't require external dependencies like multer.
 */
export function createMultipartMiddleware(
  fileMetas: UploadedFileMeta[],
  options: NormalizedMultipartOptions
): RequestHandler {
  const fieldNames = new Set(fileMetas.map((f) => f.fieldName));
  const multipleFields = new Set(
    fileMetas.filter((f) => f.multiple).map((f) => f.fieldName)
  );

  return async (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return next();
    }

    try {
      const { files, fields } = await parseMultipart(req, {
        fieldNames,
        maxFileSize: options.maxFileSize,
        maxFiles: options.maxFiles
      });

      // Merge form fields into body
      Object.assign(req.body ?? (req.body = {}), fields);

      // Attach files to request
      const filesMap: Record<string, UploadedFileInfo | UploadedFileInfo[]> = {};
      for (const file of files) {
        const info: UploadedFileInfo = {
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.buffer.length,
          buffer: file.buffer,
          fieldName: file.fieldName
        };
        if (multipleFields.has(file.fieldName)) {
          const arr = (filesMap[file.fieldName] as UploadedFileInfo[]) ?? [];
          arr.push(info);
          filesMap[file.fieldName] = arr;
        } else {
          filesMap[file.fieldName] = info;
        }
      }

      (req as Request & { files?: typeof filesMap }).files = filesMap;
      next();
    } catch (error) {
      next(error);
    }
  };
}

interface ParseOptions {
  fieldNames: Set<string>;
  maxFileSize: number;
  maxFiles: number;
}

interface ParseResult {
  files: ParsedFile[];
  fields: Record<string, string>;
}

/**
 * Parses a multipart/form-data request.
 */
async function parseMultipart(
  req: Request,
  options: ParseOptions
): Promise<ParseResult> {
  const contentType = req.headers["content-type"] ?? "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new Error("Missing multipart boundary");
  }
  const boundary = boundaryMatch[1] || boundaryMatch[2];

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks);

  const files: ParsedFile[] = [];
  const fields: Record<string, string> = {};

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = splitByBoundary(body, boundaryBuffer);

  for (const part of parts) {
    const result = parsePart(part, options);
    if (!result) continue;
    
    if ("file" in result) {
      if (files.length >= options.maxFiles) {
        throw new Error(`Too many files. Maximum is ${options.maxFiles}`);
      }
      if (result.file.buffer.length > options.maxFileSize) {
        throw new Error(
          `File ${result.file.originalName} exceeds maximum size of ${options.maxFileSize} bytes`
        );
      }
      files.push(result.file);
    } else {
      fields[result.field.name] = result.field.value;
    }
  }

  return { files, fields };
}

function splitByBoundary(buffer: Buffer, boundary: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;

  for (;;) {
    const idx = buffer.indexOf(boundary, start);
    if (idx === -1) break;

    if (start > 0) {
      // Skip CRLF before boundary
      let end = idx;
      if (buffer[idx - 1] === 0x0a) end--;
      if (buffer[idx - 2] === 0x0d) end--;
      if (end > start) {
        parts.push(buffer.subarray(start, end));
      }
    }

    start = idx + boundary.length;
    // Skip CRLF after boundary
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) {
      start += 2;
    } else if (buffer[start] === 0x2d && buffer[start + 1] === 0x2d) {
      // End boundary
      break;
    }
  }

  return parts;
}

function parsePart(
  part: Buffer,
  options: ParseOptions
): { file: ParsedFile } | { field: { name: string; value: string } } | null {
  const headerEndIdx = part.indexOf("\r\n\r\n");
  if (headerEndIdx === -1) return null;

  const headerStr = part.subarray(0, headerEndIdx).toString("utf8");
  const content = part.subarray(headerEndIdx + 4);

  const dispositionMatch = headerStr.match(
    /Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i
  );
  if (!dispositionMatch) return null;

  const fieldName = dispositionMatch[1];
  const fileName = dispositionMatch[2];

  if (fileName !== undefined) {
    // It's a file
    if (!options.fieldNames.has(fieldName)) {
      return null; // Unknown field, skip
    }
    const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
    const mimeType = contentTypeMatch?.[1]?.trim() ?? "application/octet-stream";

    return {
      file: {
        fieldName,
        originalName: fileName,
        mimeType,
        buffer: content
      }
    };
  } else {
    // It's a regular field
    return {
      field: {
        name: fieldName,
        value: content.toString("utf8")
      }
    };
  }
}

/**
 * Extracts uploaded files from the request.
 */
export function extractFiles(
  req: Request
): Record<string, UploadedFileInfo | UploadedFileInfo[]> | undefined {
  const files = (req as Request & { files?: Record<string, UploadedFileInfo | UploadedFileInfo[]> }).files;
  return files;
}

/**
 * Checks if a route has file uploads configured.
 */
export function hasFileUploads(files: UploadedFileMeta[] | undefined): boolean {
  return !!files && files.length > 0;
}
