import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import path from "node:path";

import {
  mkTmpProjectDir,
  writeFile,
  setupTestProject,
  generateCode,
  createExpressApp,
  safeRemoveDir
} from "./helpers";

describe("E2E: Date and DateTime handling", () => {
  it("handles datetime strings in request body and response", async () => {
    const dir = await mkTmpProjectDir("adorn-e2e-datetime-");

    try {
      await setupTestProject(dir, { title: "E2E DateTime", version: "1.0.0" });

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

      await generateCode(dir);
      const app = await createExpressApp(dir);

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
      await safeRemoveDir(dir);
    }
  });

  it("handles date-only strings in query parameters", async () => {
    const dir = await mkTmpProjectDir("adorn-e2e-datetime-");

    try {
      await setupTestProject(dir, { title: "E2E Date Query", version: "1.0.0" });

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

      await generateCode(dir);
      const app = await createExpressApp(dir);

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
      await safeRemoveDir(dir);
    }
  });

  it("handles datetime in path parameters", async () => {
    const dir = await mkTmpProjectDir("adorn-e2e-datetime-");

    try {
      await setupTestProject(dir, { title: "E2E DateTime Path", version: "1.0.0" });

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

      await generateCode(dir);
      const app = await createExpressApp(dir);

      // Test with timestamp in path
      const timestamp = "2025-01-15T10:30:00Z";
      const r1 = await request(app)
        .get(`/api/schedules/sched-456/${encodeURIComponent(timestamp)}`);
      
      expect(r1.status).toBe(200);
      expect(r1.body.id).toBe("sched-456");
      expect(r1.body.timestamp).toBe(timestamp);
      expect(r1.body.decoded).toBe(new Date(timestamp).toISOString());

    } finally {
      await safeRemoveDir(dir);
    }
  });

  it("handles mixed date types (datetime string, date string, number) in single endpoint", async () => {
    const dir = await mkTmpProjectDir("adorn-e2e-datetime-");

    try {
      await setupTestProject(dir, { title: "E2E Mixed Dates", version: "1.0.0" });

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

      await generateCode(dir);
      const app = await createExpressApp(dir);

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
      await safeRemoveDir(dir);
    }
  });
});
