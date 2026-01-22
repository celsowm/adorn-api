import { describe, expect, it } from "vitest";
import {
  Controller,
  Get,
  Post,
  Returns,
  Body,
  Query,
  buildOpenApi,
  createMetalCrudDtoClasses,
  createPagedResponseDtoClass,
  createPagedFilterQueryDtoClass,
  t,
  type RequestContext
} from "../index";
import { Column, Entity, PrimaryKey, col } from "metal-orm";

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
  mutationExclude: ["id", "data_exclusao", "data_inativacao"]
});

const {
  response: NotaVersaoDto,
  create: CreateNotaVersaoDto
} = notaVersaoCrud;

const NotaVersaoQueryDtoClass = createPagedFilterQueryDtoClass({
  name: "NotaVersaoQueryDto",
  filters: {
    sprint: { schema: t.integer({ minimum: 1 }), operator: "equals" },
    ativo: { schema: t.boolean(), operator: "equals" },
    mensagemContains: { schema: t.string({ minLength: 1 }), operator: "contains" }
  }
});

const NotaVersaoPagedResponseDto = createPagedResponseDtoClass({
  name: "NotaVersaoPagedResponseDto",
  itemDto: NotaVersaoDto,
  description: "Lista paginada de notas de versão."
});

@Controller({ path: "/nota-versao", tags: ["Nota Versão"] })
class NotaVersaoController {
  @Get("/")
  @Query(NotaVersaoQueryDtoClass)
  @Returns(NotaVersaoPagedResponseDto)
  async list(_ctx: RequestContext<unknown, Record<string, unknown>>) {
    return { items: [], total: 0, page: 1, pageSize: 25 };
  }

  @Post("/")
  @Body(CreateNotaVersaoDto)
  @Returns({ status: 201, schema: NotaVersaoDto })
  async create(_ctx: RequestContext<unknown>) {
    return {} as any;
  }
}

describe("e2e metal-orm CRUD DTOs to OpenAPI", () => {
  it("generates OpenAPI schemas with properties from createMetalCrudDtoClasses", () => {
    const doc = buildOpenApi({
      info: { title: "Test API", version: "1.0.0" },
      controllers: [NotaVersaoController]
    });

    const schemas = doc.components.schemas;

    // Check NotaVersaoDto has properties
    const notaVersaoDto = schemas.NotaVersaoDto;
    expect(notaVersaoDto).toBeDefined();
    expect(notaVersaoDto.type).toBe("object");
    expect(notaVersaoDto.properties).toBeDefined();
    expect(Object.keys(notaVersaoDto.properties as object).length).toBeGreaterThan(0);

    // Verify specific fields exist
    const props = notaVersaoDto.properties as Record<string, unknown>;
    expect(props.id).toBeDefined();
    expect(props.data).toBeDefined();
    expect(props.sprint).toBeDefined();
    expect(props.ativo).toBeDefined();
    expect(props.mensagem).toBeDefined();

    // Check CreateNotaVersaoDto has properties but excludes id
    const createDto = schemas.CreateNotaVersaoDto;
    expect(createDto).toBeDefined();
    expect(createDto.type).toBe("object");
    expect(createDto.properties).toBeDefined();
    expect(Object.keys(createDto.properties as object).length).toBeGreaterThan(0);

    const createProps = createDto.properties as Record<string, unknown>;
    expect(createProps.id).toBeUndefined(); // Should be excluded
    expect(createProps.data).toBeDefined();
    expect(createProps.sprint).toBeDefined();

    // Check paged response has properties
    const pagedResponse = schemas.NotaVersaoPagedResponseDto;
    expect(pagedResponse).toBeDefined();
    expect(pagedResponse.type).toBe("object");
    expect(pagedResponse.properties).toBeDefined();
    expect(Object.keys(pagedResponse.properties as object).length).toBeGreaterThan(0);
  });

  it("includes query parameters in OpenAPI spec", () => {
    const doc = buildOpenApi({
      info: { title: "Test API", version: "1.0.0" },
      controllers: [NotaVersaoController]
    });

    const listOperation = doc.paths["/nota-versao"]?.get as Record<string, unknown>;
    expect(listOperation).toBeDefined();
    expect(listOperation.parameters).toBeDefined();

    const params = listOperation.parameters as Array<Record<string, unknown>>;
    const paramNames = params.map((p) => p.name);

    expect(paramNames).toContain("page");
    expect(paramNames).toContain("pageSize");
    expect(paramNames).toContain("sprint");
    expect(paramNames).toContain("ativo");
    expect(paramNames).toContain("mensagemContains");
  });
});
