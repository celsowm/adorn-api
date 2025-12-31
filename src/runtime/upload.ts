export interface UploadFile {
  filename: string;
  mimeType: string;
  size?: number;
  stream: NodeJS.ReadableStream;
}
