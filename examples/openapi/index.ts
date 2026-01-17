import { buildOpenApi } from "../../src";
import { HealthController } from "./health.controller";

const doc = buildOpenApi({
  info: {
    title: "Health API",
    version: "1.0.0"
  },
  controllers: [HealthController]
});

console.log(JSON.stringify(doc, null, 2));
