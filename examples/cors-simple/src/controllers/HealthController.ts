import { Controller, Get } from "adorn-api";

@Controller("/health")
export class HealthController {
  @Get("/")
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
