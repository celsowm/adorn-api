import { describe, expect, it, beforeAll } from "vitest";
import request from "supertest";
import {
  Controller,
  Dto,
  Errors,
  Field,
  Get,
  HttpError,
  Returns,
  createExpressApp,
  t
} from "../../src/index";

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

const DemoErrors = Errors(ErrorDto, [
  { status: 400, description: "Bad request." }
]);

@Controller("/demo")
class DemoController {
  @Get("/bad")
  @DemoErrors
  bad() {
    throw new HttpError(400, "Bad request.");
  }

  @Get("/ok")
  @Returns({ status: 204, description: "No content." })
  @DemoErrors
  ok() {
    return;
  }
}

describe("http error handling", () => {
  let app: Awaited<ReturnType<typeof createExpressApp>>;

  beforeAll(async () => {
    app = await createExpressApp({ controllers: [DemoController] });
  });

  it("serializes HttpError responses", async () => {
    const response = await request(app).get("/demo/bad").expect(400);
    expect(response.body).toEqual({ message: "Bad request." });
  });

  it("does not let error responses override success defaults", async () => {
    await request(app).get("/demo/ok").expect(204);
  });
});
