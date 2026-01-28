import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import {
  Body,
  Controller,
  Post,
  Put,
  Returns,
  createExpressApp,
  createMetalCrudDtoClasses,
  t,
} from "../../src/index";
import {
  col,
  Entity,
  Column,
  PrimaryKey,
} from "metal-orm";

/**
 * E2E test for date field validation issue.
 * 
 * This test reproduces the scenario where:
 * 1. An entity has DATE and DATETIME columns
 * 2. DTOs are generated from the entity using createMetalCrudDtoClasses
 * 3. HTTP requests with date strings are sent
 * 4. The coercion layer converts date strings to Date objects
 * 5. Validation should accept Date objects for date/date-time format fields
 * 
 * Issue: Validation was failing with "must be a string" because the schema
 * format wasn't being checked correctly after coercion.
 */

@Entity({ tableName: "nota_versao" })
class NotaVersao {
  @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
  id!: number;

  @Column(col.notNull(col.date<Date>()))
  data!: Date;

  @Column(col.notNull(col.int()))
  sprint!: number;

  @Column(col.notNull(col.boolean()))
  ativo!: boolean;

  @Column(col.notNull(col.text()))
  mensagem!: string;

  @Column(col.datetime<Date>())
  data_exclusao?: Date;

  @Column(col.datetime<Date>())
  data_inativacao?: Date;
}

const notaVersaoCrud = createMetalCrudDtoClasses(NotaVersao, {
  response: { description: "Nota de versão retornada pela API." },
  mutationExclude: ["id"],
});

@Controller({ path: "/nota-versao", tags: ["Nota Versão"] })
class NotaVersaoController {
  @Post("/")
  @Body(notaVersaoCrud.create)
  @Returns({ status: 201, schema: notaVersaoCrud.response })
  async create(ctx: { body: typeof notaVersaoCrud.create.prototype }) {
    // Return the received body to verify coercion worked
    return {
      id: 1,
      ...ctx.body,
    };
  }

  @Put("/:id")
  @Body(notaVersaoCrud.update)
  @Returns({ status: 200, schema: notaVersaoCrud.response })
  async update(ctx: { body: typeof notaVersaoCrud.update.prototype; params: { id: string } }) {
    return {
      id: parseInt(ctx.params.id, 10),
      ...ctx.body,
    };
  }
}

describe("e2e: Date field validation after coercion", () => {
  let app: Awaited<ReturnType<typeof createExpressApp>>;

  beforeAll(async () => {
    app = await createExpressApp({
      controllers: [NotaVersaoController],
    });
  });

  describe("POST /nota-versao with date fields", () => {
    it("should accept date string for DATE column", async () => {
      const response = await request(app)
        .post("/nota-versao")
        .send({
          data: "2026-01-28",
          sprint: 1,
          ativo: true,
          mensagem: "Test message",
        })
        .expect(201);

      expect(response.body).toMatchObject({
        sprint: 1,
        ativo: true,
        mensagem: "Test message",
      });
    });

    it("should accept date-time string for DATETIME columns", async () => {
      const response = await request(app)
        .post("/nota-versao")
        .send({
          data: "2026-01-28",
          sprint: 2,
          ativo: true,
          mensagem: "Test with datetime",
          data_exclusao: "2026-01-28T20:09:51.070Z",
          data_inativacao: "2026-01-28T20:09:51.070Z",
        })
        .expect(201);

      expect(response.body).toMatchObject({
        sprint: 2,
        ativo: true,
        mensagem: "Test with datetime",
      });
    });

    it("should accept null for optional DATETIME columns", async () => {
      const response = await request(app)
        .post("/nota-versao")
        .send({
          data: "2026-01-28",
          sprint: 3,
          ativo: false,
          mensagem: "Test with nulls",
          data_exclusao: null,
          data_inativacao: null,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        sprint: 3,
        ativo: false,
        mensagem: "Test with nulls",
      });
    });

    it("should reject invalid date string", async () => {
      const response = await request(app)
        .post("/nota-versao")
        .send({
          data: "not-a-date",
          sprint: 1,
          ativo: true,
          mensagem: "Invalid date",
        })
        .expect(400);

      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: "data",
        })
      );
    });

    it("should reject invalid date-time string", async () => {
      const response = await request(app)
        .post("/nota-versao")
        .send({
          data: "2026-01-28",
          sprint: 1,
          ativo: true,
          mensagem: "Invalid datetime",
          data_exclusao: "not-a-datetime",
        })
        .expect(400);

      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: "data_exclusao",
        })
      );
    });
  });

  describe("PUT /nota-versao/:id with date fields", () => {
    let createdId: number;

    beforeAll(async () => {
      const response = await request(app)
        .post("/nota-versao")
        .send({
          data: "2026-01-01",
          sprint: 10,
          ativo: true,
          mensagem: "To be updated",
        });
      createdId = response.body.id;
    });

    it("should accept date updates", async () => {
      const response = await request(app)
        .put(`/nota-versao/${createdId}`)
        .send({
          data: "2026-02-15",
          sprint: 11,
          ativo: false,
          mensagem: "Updated message",
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdId,
        sprint: 11,
        ativo: false,
        mensagem: "Updated message",
      });
    });

    it("should accept datetime updates", async () => {
      const response = await request(app)
        .put(`/nota-versao/${createdId}`)
        .send({
          data: "2026-02-15",
          sprint: 12,
          ativo: true,
          mensagem: "Updated with datetime",
          data_exclusao: "2026-03-01T10:00:00.000Z",
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdId,
        sprint: 12,
      });
    });
  });
});

describe("Unit: Date object validation with date/date-time format", () => {
  it("should accept Date object when schema has date format", async () => {
    const { validate } = await import("../../src/core/validation");
    
    const dateValue = new Date("2026-01-28");
    const errors = validate(dateValue, t.string({ format: "date" }));
    
    expect(errors).toEqual([]);
  });

  it("should accept Date object when schema has date-time format", async () => {
    const { validate } = await import("../../src/core/validation");
    
    const dateValue = new Date("2026-01-28T20:09:51.070Z");
    const errors = validate(dateValue, t.string({ format: "date-time" }));
    
    expect(errors).toEqual([]);
  });

  it("should reject Date object when schema has no date format", async () => {
    const { validate } = await import("../../src/core/validation");
    
    const dateValue = new Date("2026-01-28");
    const errors = validate(dateValue, t.string());
    
    expect(errors).toEqual([
      expect.objectContaining({
        message: "must be a string",
      }),
    ]);
  });

  it("should reject invalid Date object", async () => {
    const { validate } = await import("../../src/core/validation");
    
    const invalidDate = new Date("invalid");
    const errors = validate(invalidDate, t.string({ format: "date" }));
    
    expect(errors).toEqual([
      expect.objectContaining({
        message: "must be a valid date",
      }),
    ]);
  });

  it("should reject invalid Date object for date-time format", async () => {
    const { validate } = await import("../../src/core/validation");
    
    const invalidDate = new Date("invalid");
    const errors = validate(invalidDate, t.string({ format: "date-time" }));
    
    expect(errors).toEqual([
      expect.objectContaining({
        message: "must be a valid date-time",
      }),
    ]);
  });
});
