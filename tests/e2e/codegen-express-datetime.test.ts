import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadConfig } from "../../src/config/loadConfig";
import { generateRoutes } from "../../src/codegen/generateRoutes";
import { generateOpenapi } from "../../src/openapi/generateOpenapi";

async function mkTmpProjectDir(): Promise<string> {
  const root = process.cwd();
  const base = path.join(root, ".vitest-tmp");
  await fs.mkdir(base, { recursive: true });
  return fs.mkdtemp(path.join(base, "adorn-e2e-datetime-"));
}

async function writeFile(p: string, content: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
}

describe("E2E: Date and DateTime handling", () => {
  it("handles datetime strings in request body and response", async () => {
    const dir = await mkTmpProjectDir();

    try {
      await writeFile(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: true
            },
            include: ["src/**/*.ts"]
          },
          null,
          2
        )
      );

      await writeFile(
        path.join(dir, "adorn.config.ts"),
        `
import { defineConfig } from "adorn-api/config";

export default defineConfig({
  generation: {
    rootDir: ${JSON.stringify(dir)},
    tsConfigPath: "./tsconfig.json",
    controllers: { include: ["src/controllers/**/*.controller.ts"] },
    basePath: "/api",
    framework: "express",
    outputs: {
      routes: "src/generated/routes.ts",
      openapi: "src/generated/openapi.json"
    },
    inference: {
      inferPathParamsFromTemplate: true,
      defaultDtoFieldSource: "smart",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    info: { title: "E2E DateTime", version: "1.0.0" }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/events.controller.ts"),
        `
import { Controller, Post } from "adorn-api/decorators";

class CreateEventDto {
  name!: string;
  startDate!: string;
  endDate?: string;
  createdAt!: string;
}

@Controller("events")
export class EventsController {
  @Post("/")
  async createEvent(dto: CreateEventDto) {
    return {
      id: "evt-123",
      name: dto.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
      createdAt: dto.createdAt
    };
  }
}
`.trim()
      );

      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });

      await generateRoutes(config);
      await generateOpenapi(config);

      const routesFile = path.join(dir, "src/generated/routes.ts");
      const mod = await import(pathToFileURL(routesFile).href);
      const RegisterRoutes = mod.RegisterRoutes as (app: express.Express) => void;

      const app = express();
      app.use(express.json());
      RegisterRoutes(app);

      // Test with ISO datetime strings
      const startDate = "2025-01-15T10:30:00.000Z";
      const createdAt = "2025-01-10T08:00:00.000Z";
      
      const r1 = await request(app)
        .post("/api/events")
        .send({
          name: "Conference 2025",
          startDate: startDate,
          createdAt: createdAt
        });
      
      expect(r1.status).toBe(200);
      expect(r1.body).toEqual({
        id: "evt-123",
        name: "Conference 2025",
        startDate: startDate,
        endDate: undefined,
        createdAt: createdAt
      });

      // Test with optional endDate
      const endDate = "2025-01-15T18:00:00.000Z";
      
      const r2 = await request(app)
        .post("/api/events")
        .send({
          name: "Workshop",
          startDate: startDate,
          endDate: endDate,
          createdAt: createdAt
        });
      
      expect(r2.status).toBe(200);
      expect(r2.body).toEqual({
        id: "evt-123",
        name: "Workshop",
        startDate: startDate,
        endDate: endDate,
        createdAt: createdAt
      });

    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("handles date-only strings in query parameters", async () => {
    const dir = await mkTmpProjectDir();

    try {
      await writeFile(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: true
            },
            include: ["src/**/*.ts"]
          },
          null,
          2
        )
      );

      await writeFile(
        path.join(dir, "adorn.config.ts"),
        `
import { defineConfig } from "adorn-api/config";

export default defineConfig({
  generation: {
    rootDir: ${JSON.stringify(dir)},
    tsConfigPath: "./tsconfig.json",
    controllers: { include: ["src/controllers/**/*.controller.ts"] },
    basePath: "/api",
    framework: "express",
    outputs: {
      routes: "src/generated/routes.ts",
      openapi: "src/generated/openapi.json"
    },
    inference: {
      inferPathParamsFromTemplate: true,
      defaultDtoFieldSource: "smart",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    info: { title: "E2E Date Query", version: "1.0.0" }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/appointments.controller.ts"),
        `
import { Controller, Get } from "adorn-api/decorators";

class GetAppointmentsDto {
  date!: string;
  userId?: string;
}

@Controller("appointments")
export class AppointmentsController {
  @Get("/")
  async getAppointments(dto: GetAppointmentsDto) {
    return {
      date: dto.date,
      userId: dto.userId,
      message: "Appointments for " + dto.date
    };
  }
}
`.trim()
      );

      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });

      await generateRoutes(config);
      await generateOpenapi(config);

      const routesFile = path.join(dir, "src/generated/routes.ts");
      const mod = await import(pathToFileURL(routesFile).href);
      const RegisterRoutes = mod.RegisterRoutes as (app: express.Express) => void;

      const app = express();
      app.use(express.json());
      RegisterRoutes(app);

      // Test with date-only format
      const r1 = await request(app)
        .get("/api/appointments")
        .query({ date: "2025-01-15", userId: "user-123" });
      
      expect(r1.status).toBe(200);
      expect(r1.body).toEqual({
        date: "2025-01-15",
        userId: "user-123",
        message: "Appointments for 2025-01-15"
      });

      // Test without optional userId
      const r2 = await request(app)
        .get("/api/appointments")
        .query({ date: "2025-01-20" });
      
      expect(r2.status).toBe(200);
      expect(r2.body).toEqual({
        date: "2025-01-20",
        userId: undefined,
        message: "Appointments for 2025-01-20"
      });

    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("handles datetime in path parameters", async () => {
    const dir = await mkTmpProjectDir();

    try {
      await writeFile(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: true
            },
            include: ["src/**/*.ts"]
          },
          null,
          2
        )
      );

      await writeFile(
        path.join(dir, "adorn.config.ts"),
        `
import { defineConfig } from "adorn-api/config";

export default defineConfig({
  generation: {
    rootDir: ${JSON.stringify(dir)},
    tsConfigPath: "./tsconfig.json",
    controllers: { include: ["src/controllers/**/*.controller.ts"] },
    basePath: "/api",
    framework: "express",
    outputs: {
      routes: "src/generated/routes.ts",
      openapi: "src/generated/openapi.json"
    },
    inference: {
      inferPathParamsFromTemplate: true,
      defaultDtoFieldSource: "smart",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    info: { title: "E2E DateTime Path", version: "1.0.0" }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/schedules.controller.ts"),
        `
import { Controller, Get } from "adorn-api/decorators";

class GetScheduleDto {
  id!: string;
  timestamp!: string;
}

@Controller("schedules")
export class SchedulesController {
  @Get("{id}/{timestamp}")
  async getSchedule(dto: GetScheduleDto) {
    return {
      id: dto.id,
      timestamp: dto.timestamp,
      decoded: new Date(dto.timestamp).toISOString()
    };
  }
}
`.trim()
      );

      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });

      await generateRoutes(config);
      await generateOpenapi(config);

      const routesFile = path.join(dir, "src/generated/routes.ts");
      const mod = await import(pathToFileURL(routesFile).href);
      const RegisterRoutes = mod.RegisterRoutes as (app: express.Express) => void;

      const app = express();
      app.use(express.json());
      RegisterRoutes(app);

      // Test with timestamp in path
      const timestamp = "2025-01-15T10:30:00Z";
      const r1 = await request(app)
        .get(`/api/schedules/sched-456/${encodeURIComponent(timestamp)}`);
      
      expect(r1.status).toBe(200);
      expect(r1.body.id).toBe("sched-456");
      expect(r1.body.timestamp).toBe(timestamp);
      expect(r1.body.decoded).toBe(new Date(timestamp).toISOString());

    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("handles mixed date types (datetime string, date string, number) in single endpoint", async () => {
    const dir = await mkTmpProjectDir();

    try {
      await writeFile(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: true
            },
            include: ["src/**/*.ts"]
          },
          null,
          2
        )
      );

      await writeFile(
        path.join(dir, "adorn.config.ts"),
        `
import { defineConfig } from "adorn-api/config";

export default defineConfig({
  generation: {
    rootDir: ${JSON.stringify(dir)},
    tsConfigPath: "./tsconfig.json",
    controllers: { include: ["src/controllers/**/*.controller.ts"] },
    basePath: "/api",
    framework: "express",
    outputs: {
      routes: "src/generated/routes.ts",
      openapi: "src/generated/openapi.json"
    },
    inference: {
      inferPathParamsFromTemplate: true,
      defaultDtoFieldSource: "smart",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    info: { title: "E2E Mixed Dates", version: "1.0.0" }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/logs.controller.ts"),
        `
import { Controller, Post } from "adorn-api/decorators";

class CreateLogDto {
  message!: string;
  timestamp!: string;
  level!: string;
  userId?: string;
  dateStr?: string;
  timestampNum?: number;
}

@Controller("logs")
export class LogsController {
  @Post("/")
  async createLog(dto: CreateLogDto) {
    return {
      id: "log-999",
      message: dto.message,
      timestamp: dto.timestamp,
      level: dto.level,
      userId: dto.userId,
      dateStr: dto.dateStr,
      timestampNum: dto.timestampNum
    };
  }
}
`.trim()
      );

      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });

      await generateRoutes(config);
      await generateOpenapi(config);

      const routesFile = path.join(dir, "src/generated/routes.ts");
      const mod = await import(pathToFileURL(routesFile).href);
      const RegisterRoutes = mod.RegisterRoutes as (app: express.Express) => void;

      const app = express();
      app.use(express.json());
      RegisterRoutes(app);

      // Test with mixed date types
      const timestamp = "2025-01-15T14:30:00.000Z";
      const timestampNum = 1736944200000;
      
      const r = await request(app)
        .post("/api/logs")
        .send({
          message: "User logged in",
          timestamp: timestamp,
          level: "INFO",
          userId: "user-123",
          dateStr: "2025-01-15",
          timestampNum: timestampNum
        });
      
      expect(r.status).toBe(200);
      expect(r.body).toEqual({
        id: "log-999",
        message: "User logged in",
        timestamp: timestamp,
        level: "INFO",
        userId: "user-123",
        dateStr: "2025-01-15",
        timestampNum: timestampNum
      });

    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
