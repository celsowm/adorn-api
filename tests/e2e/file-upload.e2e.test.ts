import { describe, it, expect } from "vitest";
import request from "supertest";
import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  Returns,
  Body,
  Dto,
  Field,
  t,
  createExpressApp,
  type RequestContext,
  type UploadedFileInfo
} from "../../src";

describe("File Upload E2E", () => {
  it("should handle single file upload", async () => {
    @Controller("/api")
    class SingleFileController {
      @Post("/upload")
      @UploadedFile("file", t.file())
      @Returns({ status: 200, description: "Success" })
      async upload(ctx: RequestContext<unknown, undefined, undefined, undefined, { file: UploadedFileInfo }>) {
        return {
          fileName: ctx.files?.file?.originalName,
          size: ctx.files?.file?.size,
          mimeType: ctx.files?.file?.mimeType
        };
      }
    }

    const app = await createExpressApp({
      controllers: [SingleFileController],
      multipart: true
    });

    const response = await request(app)
      .post("/api/upload")
      .attach("file", Buffer.from("test file content"), "test.txt");

    expect(response.status).toBe(200);
    expect(response.body.fileName).toBe("test.txt");
    expect(response.body.size).toBe(17);
    expect(response.body.mimeType).toBe("text/plain");
  });

  it("should handle multiple files in a single field", async () => {
    @Controller("/api")
    class MultiFileController {
      @Post("/upload-many")
      @UploadedFiles("files", t.file())
      @Returns({ status: 200, description: "Success" })
      async uploadMany(ctx: RequestContext<unknown, undefined, undefined, undefined, { files: UploadedFileInfo[] }>) {
        const files = ctx.files?.files ?? [];
        return {
          count: files.length,
          fileNames: files.map(f => f.originalName)
        };
      }
    }

    const app = await createExpressApp({
      controllers: [MultiFileController],
      multipart: true
    });

    const response = await request(app)
      .post("/api/upload-many")
      .attach("files", Buffer.from("file 1"), "file1.txt")
      .attach("files", Buffer.from("file 2"), "file2.txt");

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.fileNames).toContain("file1.txt");
    expect(response.body.fileNames).toContain("file2.txt");
  });

  it("should handle file with additional form fields", async () => {
    @Dto()
    class UploadMetadataDto {
      @Field(t.string())
      title!: string;
    }

    @Controller("/api")
    class FileWithFieldsController {
      @Post("/document")
      @UploadedFile("document", t.file())
      @Body(UploadMetadataDto)
      @Returns({ status: 200, description: "Success" })
      async uploadDocument(ctx: RequestContext<UploadMetadataDto, undefined, undefined, undefined, { document: UploadedFileInfo }>) {
        return {
          title: ctx.body.title,
          fileName: ctx.files?.document?.originalName
        };
      }
    }

    const app = await createExpressApp({
      controllers: [FileWithFieldsController],
      multipart: true
    });

    const response = await request(app)
      .post("/api/document")
      .field("title", "My Document")
      .attach("document", Buffer.from("doc content"), "doc.pdf");

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("My Document");
    expect(response.body.fileName).toBe("doc.pdf");
  });

  it("should include file uploads in OpenAPI documentation", async () => {
    @Controller("/api")
    class DocController {
      @Post("/file")
      @UploadedFile("file", t.file({ description: "The file to upload" }))
      @Returns({ status: 200, description: "Success" })
      async upload() {
        return { success: true };
      }
    }

    const app = await createExpressApp({
      controllers: [DocController],
      openApi: {
        info: { title: "Test API", version: "1.0.0" },
        path: "/openapi.json"
      }
    });

    const response = await request(app).get("/openapi.json");
    expect(response.status).toBe(200);

    const paths = response.body.paths;
    expect(paths["/api/file"]).toBeDefined();
    expect(paths["/api/file"].post.requestBody.content["multipart/form-data"]).toBeDefined();

    const schema = paths["/api/file"].post.requestBody.content["multipart/form-data"].schema;
    expect(schema.properties.file).toEqual({
      type: "string",
      format: "binary",
      description: "The file to upload"
    });
  });
});
