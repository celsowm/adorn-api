/**
 * Represents an uploaded file in the request.
 * 
 * @remarks
 * This interface describes the structure of a file uploaded via multipart/form-data
 * requests. It provides metadata about the file as well as access to its contents
 * through a readable stream.
 * 
 * @example
 * ```typescript
 * async function handleUpload(file: UploadFile) {
 *   console.log(`Received file: ${file.filename}`);
 *   console.log(`Type: ${file.mimeType}`);
 *   console.log(`Size: ${file.size} bytes`);
 *   
 *   // Process the file stream
 *   for await (const chunk of file.stream) {
 *     // Handle chunk...
 *   }
 * }
 * ```
 * 
 * @public
 */
export interface UploadFile {
  /**
   * The original filename as sent by the client.
   */
  filename: string;
  
  /**
   * The MIME type of the file (e.g., "image/png", "application/pdf").
   */
  mimeType: string;
  
  /**
   * The file size in bytes, if available.
   */
  size?: number;
  
  /**
   * A Node.js readable stream to read the file contents.
   * Use this to pipe, transform, or buffer the file data.
   */
  stream: NodeJS.ReadableStream;
}
