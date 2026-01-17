import { Controller, Dto, Field, Get, Returns, buildOpenApi, t } from "../../src";

@Dto()
class HealthDto {
  @Field(t.string())
  message!: string;
}

@Controller("/health")
class HealthController {
  @Get("/")
  @Returns(HealthDto)
  ping() {
    return { message: "ok" };
  }
}

const doc = buildOpenApi({
  info: {
    title: "Health API",
    version: "1.0.0"
  },
  controllers: [HealthController]
});

console.log(JSON.stringify(doc, null, 2));
