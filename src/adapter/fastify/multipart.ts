import type { FastifyRequest } from "fastify";
import type { UploadedFileMeta } from "../../core/metadata";
import type { UploadedFileInfo } from "../../core/types";
import type { MultipartOptions } from "./types";

/**
 * Normalized multipart options with defaults applied.
 */
export interface NormalizedMultipartOptions {
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
 * Extracts uploaded files from the Fastify request.
 * For Fastify, files are expected to be attached to the request by @fastify/multipart
 */
export async function extractFiles(
  req: FastifyRequest
): Promise<Record<string, UploadedFileInfo | UploadedFileInfo[]> | undefined> {
  const parts = (req as any).parts();
  const filesMap: Record<string, UploadedFileInfo | UploadedFileInfo[]> = {};

  const fields: Record<string, any> = {};

  for await (const part of parts) {
    if ((part as any).file) {
      const buffer = await (part as any).toBuffer();
      const info: UploadedFileInfo = {
        originalName: (part as any).filename,
        mimeType: (part as any).mimetype,
        size: buffer.length,
        buffer: buffer,
        fieldName: (part as any).fieldname
      };

      if (filesMap[(part as any).fieldname]) {
        if (Array.isArray(filesMap[(part as any).fieldname])) {
          (filesMap[(part as any).fieldname] as UploadedFileInfo[]).push(info);
        } else {
          filesMap[(part as any).fieldname] = [filesMap[(part as any).fieldname] as UploadedFileInfo, info];
        }
      } else {
        filesMap[(part as any).fieldname] = info;
      }
    } else {
      // It's a field
      fields[(part as any).fieldname] = (part as any).value;
    }
  }

  // Merge fields into body if it's a multipart request
  if (Object.keys(fields).length > 0) {
    Object.assign(req.body ?? (req.body = {}), fields);
  }

  return Object.keys(filesMap).length > 0 ? filesMap : undefined;
}

/**
 * Checks if a route has file uploads configured.
 */
export function hasFileUploads(files: UploadedFileMeta[] | undefined): boolean {
  return !!files && files.length > 0;
}
