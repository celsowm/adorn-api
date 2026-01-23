import { describe, it, expect, beforeEach } from "vitest";
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
  buildOpenApi
} from "../../src";
import { getControllerMeta } from "../../src/core/metadata";

// Reset metadata stores between tests
beforeEach(() => {
  // Clear controller and DTO registries
});

describe("@UploadedFile decorator", () => {
  it("should register a single file upload field", () => {
    @Controller("/upload")
    class UploadController {
      @Post("/avatar")
      @UploadedFile("avatar", t.file({ description: "User avatar image" }))
      @Returns({ status: 200, description: "Upload successful" })
      async uploadAvatar() {
        return { success: true };
      }
    }

    const meta = getControllerMeta(UploadController);
    expect(meta).toBeDefined();
    expect(meta!.routes).toHaveLength(1);
    expect(meta!.routes[0].files).toHaveLength(1);
    expect(meta!.routes[0].files![0].fieldName).toBe("avatar");
    expect(meta!.routes[0].files![0].multiple).toBe(false);
    expect(meta!.routes[0].files![0].required).toBe(true);
  });

  it("should support optional file uploads", () => {
    @Controller("/upload")
    class OptionalUploadController {
      @Post("/document")
      @UploadedFile("doc", t.file(), { required: false })
      @Returns({ status: 200, description: "Upload successful" })
      async uploadDoc() {
        return { success: true };
      }
    }

    const meta = getControllerMeta(OptionalUploadController);
    expect(meta!.routes[0].files![0].required).toBe(false);
  });

  it("should support file description", () => {
    @Controller("/upload")
    class DescribedUploadController {
      @Post("/photo")
      @UploadedFile("photo", t.file(), { description: "Profile photo" })
      @Returns({ status: 200, description: "Upload successful" })
      async uploadPhoto() {
        return { success: true };
      }
    }

    const meta = getControllerMeta(DescribedUploadController);
    expect(meta!.routes[0].files![0].description).toBe("Profile photo");
  });
});

describe("@UploadedFiles decorator", () => {
  it("should register multiple file upload field", () => {
    @Controller("/upload")
    class MultiUploadController {
      @Post("/gallery")
      @UploadedFiles("images", t.file({ description: "Gallery images" }))
      @Returns({ status: 200, description: "Upload successful" })
      async uploadGallery() {
        return { success: true };
      }
    }

    const meta = getControllerMeta(MultiUploadController);
    expect(meta!.routes[0].files).toHaveLength(1);
    expect(meta!.routes[0].files![0].fieldName).toBe("images");
    expect(meta!.routes[0].files![0].multiple).toBe(true);
  });
});

describe("Multiple file fields", () => {
  it("should support multiple different file fields", () => {
    @Controller("/upload")
    class MultiFieldController {
      @Post("/product")
      @UploadedFile("thumbnail", t.file())
      @UploadedFiles("gallery", t.file())
      @Returns({ status: 200, description: "Upload successful" })
      async uploadProduct() {
        return { success: true };
      }
    }

    const meta = getControllerMeta(MultiFieldController);
    expect(meta!.routes[0].files).toHaveLength(2);
    // Decorators are applied bottom-to-top, so gallery comes first
    const fieldNames = meta!.routes[0].files!.map(f => f.fieldName);
    expect(fieldNames).toContain("thumbnail");
    expect(fieldNames).toContain("gallery");
    
    const thumbnailFile = meta!.routes[0].files!.find(f => f.fieldName === "thumbnail");
    const galleryFile = meta!.routes[0].files!.find(f => f.fieldName === "gallery");
    expect(thumbnailFile!.multiple).toBe(false);
    expect(galleryFile!.multiple).toBe(true);
  });
});

describe("t.file() schema builder", () => {
  it("should create a file schema with defaults", () => {
    const schema = t.file();
    expect(schema.kind).toBe("file");
    expect(schema.accept).toBeUndefined();
    expect(schema.maxSize).toBeUndefined();
  });

  it("should create a file schema with options", () => {
    const schema = t.file({
      accept: ["image/*", "application/pdf"],
      maxSize: 5 * 1024 * 1024,
      description: "Upload file"
    });
    expect(schema.kind).toBe("file");
    expect(schema.accept).toEqual(["image/*", "application/pdf"]);
    expect(schema.maxSize).toBe(5 * 1024 * 1024);
    expect(schema.description).toBe("Upload file");
  });
});

describe("OpenAPI generation for file uploads", () => {
  it("should generate multipart/form-data request body for file uploads", () => {
    @Controller("/api")
    class FileApiController {
      @Post("/upload")
      @UploadedFile("file", t.file({ description: "File to upload" }))
      @Returns({ status: 200, description: "Success" })
      async upload() {
        return { success: true };
      }
    }

    const openapi = buildOpenApi({
      info: { title: "Test API", version: "1.0.0" },
      controllers: [FileApiController]
    });

    const uploadPath = openapi.paths["/api/upload"] as Record<string, unknown>;
    expect(uploadPath).toBeDefined();
    expect(uploadPath.post).toBeDefined();

    const postOp = uploadPath.post as { requestBody: unknown };
    const requestBody = postOp.requestBody as {
      content: { "multipart/form-data": { schema: { properties: Record<string, unknown> } } };
    };
    expect(requestBody.content["multipart/form-data"]).toBeDefined();
    expect(requestBody.content["multipart/form-data"].schema.properties.file).toEqual({
      type: "string",
      format: "binary",
      description: "File to upload"
    });
  });

  it("should generate array schema for multiple files", () => {
    @Controller("/api")
    class MultiFileApiController {
      @Post("/upload-many")
      @UploadedFiles("files", t.file())
      @Returns({ status: 200, description: "Success" })
      async uploadMany() {
        return { success: true };
      }
    }

    const openapi = buildOpenApi({
      info: { title: "Test API", version: "1.0.0" },
      controllers: [MultiFileApiController]
    });

    const uploadPath = openapi.paths["/api/upload-many"] as Record<string, unknown>;
    const postOp = uploadPath.post as { requestBody: unknown };
    const requestBody = postOp.requestBody as {
      content: { "multipart/form-data": { schema: { properties: Record<string, unknown> } } };
    };
    expect(requestBody.content["multipart/form-data"].schema.properties.files).toEqual({
      type: "array",
      items: { type: "string", format: "binary" }
    });
  });

  it("should include body fields in multipart request", () => {
    @Dto()
    class UploadMetadataDto {
      @Field(t.string())
      title!: string;

      @Field(t.string({ optional: true }))
      description?: string;
    }

    @Controller("/api")
    class FileWithBodyController {
      @Post("/document")
      @UploadedFile("document", t.file())
      @Body(UploadMetadataDto)
      @Returns({ status: 200, description: "Success" })
      async uploadDocument() {
        return { success: true };
      }
    }

    const openapi = buildOpenApi({
      info: { title: "Test API", version: "1.0.0" },
      controllers: [FileWithBodyController]
    });

    const uploadPath = openapi.paths["/api/document"] as Record<string, unknown>;
    const postOp = uploadPath.post as { requestBody: unknown };
    const requestBody = postOp.requestBody as {
      content: { "multipart/form-data": { schema: { properties: Record<string, unknown>; required?: string[] } } };
    };
    const schema = requestBody.content["multipart/form-data"].schema;

    // Should have both file and body fields
    expect(schema.properties.document).toBeDefined();
    expect(schema.properties.title).toBeDefined();
    expect(schema.properties.description).toBeDefined();

    // Required should include file and required body fields
    expect(schema.required).toContain("document");
    expect(schema.required).toContain("title");
    expect(schema.required).not.toContain("description");
  });

  it("should mark optional files as not required", () => {
    @Controller("/api")
    class OptionalFileController {
      @Post("/optional")
      @UploadedFile("attachment", t.file(), { required: false })
      @Returns({ status: 200, description: "Success" })
      async uploadOptional() {
        return { success: true };
      }
    }

    const openapi = buildOpenApi({
      info: { title: "Test API", version: "1.0.0" },
      controllers: [OptionalFileController]
    });

    const uploadPath = openapi.paths["/api/optional"] as Record<string, unknown>;
    const postOp = uploadPath.post as { requestBody: unknown };
    const requestBody = postOp.requestBody as {
      content: { "multipart/form-data": { schema: { required?: string[] } } };
    };
    const schema = requestBody.content["multipart/form-data"].schema;

    expect(schema.required).toBeUndefined();
  });
});
