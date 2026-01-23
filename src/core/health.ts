import { Dto, Field, Controller, Get, Returns, Doc } from "./decorators";
import { t } from "./schema";
import type { Constructor } from "./types";
import type { RequestContext } from "../adapter/express/types";

/**
 * Health status values.
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/**
 * Result of a single health indicator check.
 */
export interface HealthIndicatorResult {
  /** Status of this indicator */
  status: HealthStatus;
  /** Optional message providing details */
  message?: string;
  /** Optional additional data */
  data?: Record<string, unknown>;
}

/**
 * Function that performs a health check.
 */
export type HealthIndicator = () => HealthIndicatorResult | Promise<HealthIndicatorResult>;

/**
 * Named health indicator with a key and check function.
 */
export interface NamedHealthIndicator {
  /** Unique key identifying this indicator */
  key: string;
  /** The health check function */
  check: HealthIndicator;
}

/**
 * Options for creating a health controller.
 */
export interface HealthControllerOptions {
  /** Base path for health endpoints (default: "/health") */
  path?: string;
  /** Array of health indicators to check */
  indicators?: NamedHealthIndicator[];
  /** Tags for OpenAPI documentation */
  tags?: string[];
}

/**
 * DTO for individual component health status.
 */
@Dto({ description: "Health status of a single component" })
export class HealthComponentDto {
  @Field(t.enum(["healthy", "degraded", "unhealthy"], { description: "Component status" }))
  status!: HealthStatus;

  @Field(t.optional(t.string({ description: "Additional status message" })))
  message?: string;

  @Field(t.optional(t.record(t.any(), { description: "Additional data" })))
  data?: Record<string, unknown>;
}

/**
 * DTO for overall health check response.
 */
@Dto({ description: "Overall health check response" })
export class HealthResponseDto {
  @Field(t.enum(["healthy", "degraded", "unhealthy"], { description: "Overall status" }))
  status!: HealthStatus;

  @Field(t.optional(t.record(t.ref(HealthComponentDto), { description: "Component statuses" })))
  components?: Record<string, HealthComponentDto>;

  @Field(t.string({ description: "Timestamp of the health check" }))
  timestamp!: string;
}

/**
 * DTO for simple liveness probe response.
 */
@Dto({ description: "Simple liveness probe response" })
export class LivenessDto {
  @Field(t.literal("ok", { description: "Liveness status" }))
  status!: "ok";
}

/**
 * Determines the overall status from component statuses.
 */
function aggregateStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.some((s) => s === "unhealthy")) {
    return "unhealthy";
  }
  if (statuses.some((s) => s === "degraded")) {
    return "degraded";
  }
  return "healthy";
}

/**
 * Creates a health check controller with the specified options.
 * @param options - Health controller configuration
 * @returns Controller class for health endpoints
 */
export function createHealthController(options: HealthControllerOptions = {}): Constructor {
  const basePath = options.path ?? "/health";
  const indicators = options.indicators ?? [];
  const tags = options.tags ?? ["Health"];

  @Controller({ path: basePath, tags })
  class HealthController {
    @Get("/")
    @Doc({ summary: "Health check", description: "Returns the health status of the application and its components" })
    @Returns(HealthResponseDto)
    async check(_ctx: RequestContext): Promise<HealthResponseDto> {
      const components: Record<string, HealthComponentDto> = {};
      const statuses: HealthStatus[] = [];

      for (const indicator of indicators) {
        try {
          const result = await indicator.check();
          components[indicator.key] = {
            status: result.status,
            message: result.message,
            data: result.data
          };
          statuses.push(result.status);
        } catch (error) {
          components[indicator.key] = {
            status: "unhealthy",
            message: error instanceof Error ? error.message : "Unknown error"
          };
          statuses.push("unhealthy");
        }
      }

      return {
        status: statuses.length > 0 ? aggregateStatus(statuses) : "healthy",
        components: Object.keys(components).length > 0 ? components : undefined,
        timestamp: new Date().toISOString()
      };
    }

    @Get("/live")
    @Doc({ summary: "Liveness probe", description: "Simple liveness check for container orchestration" })
    @Returns(LivenessDto)
    live(_ctx: RequestContext): LivenessDto {
      return { status: "ok" };
    }

    @Get("/ready")
    @Doc({ summary: "Readiness probe", description: "Checks if application is ready to receive traffic" })
    @Returns(HealthResponseDto)
    async ready(_ctx: RequestContext): Promise<HealthResponseDto> {
      return this.check(_ctx);
    }
  }

  return HealthController;
}

/**
 * Creates a database health indicator.
 * @param name - Name of the database
 * @param pingFn - Function to ping the database (should throw on failure)
 * @returns Named health indicator
 */
export function databaseIndicator(
  name: string,
  pingFn: () => Promise<void> | void
): NamedHealthIndicator {
  return {
    key: name,
    check: async () => {
      try {
        await pingFn();
        return { status: "healthy" };
      } catch (error) {
        return {
          status: "unhealthy",
          message: error instanceof Error ? error.message : "Database unreachable"
        };
      }
    }
  };
}

/**
 * Creates a memory usage health indicator.
 * @param thresholds - Memory thresholds in MB
 * @returns Named health indicator
 */
export function memoryIndicator(thresholds?: {
  degradedMB?: number;
  unhealthyMB?: number;
}): NamedHealthIndicator {
  const degradedMB = thresholds?.degradedMB ?? 512;
  const unhealthyMB = thresholds?.unhealthyMB ?? 1024;

  return {
    key: "memory",
    check: () => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);

      let status: HealthStatus = "healthy";
      if (heapUsedMB >= unhealthyMB) {
        status = "unhealthy";
      } else if (heapUsedMB >= degradedMB) {
        status = "degraded";
      }

      return {
        status,
        data: {
          heapUsedMB,
          heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
          rssMB: Math.round(usage.rss / 1024 / 1024)
        }
      };
    }
  };
}

/**
 * Creates a custom health indicator.
 * @param key - Unique identifier for this indicator
 * @param check - Health check function
 * @returns Named health indicator
 */
export function customIndicator(key: string, check: HealthIndicator): NamedHealthIndicator {
  return { key, check };
}
