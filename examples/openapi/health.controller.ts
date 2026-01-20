import { Controller, Get, Returns } from "../../src";
import { HealthDto } from "./health.dto";

@Controller("/health")
export class HealthController {
  @Get("/")
  @Returns(HealthDto)
  ping() {
    return { message: "ok" };
  }
}
