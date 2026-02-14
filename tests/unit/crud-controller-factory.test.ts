import { describe, expect, it } from "vitest";
import {
  buildOpenApi,
  createCrudController,
  createMetalCrudDtoClasses,
  t,
  type RequestContext
} from "../../src/index";
import { getControllerMeta } from "../../src/core/metadata";
import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "crud_factory_entities" })
class CrudFactoryEntity {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  nome!: string;

  @Column(col.notNull(col.boolean()))
  ativo!: boolean;
}

const crudDtos = createMetalCrudDtoClasses(CrudFactoryEntity, {
  mutationExclude: ["id"],
  query: {
    filters: {
      nomeContains: {
        schema: t.string({ minLength: 1 }),
        field: "nome",
        operator: "contains"
      },
      ativo: {
        schema: t.boolean(),
        field: "ativo",
        operator: "equals"
      }
    },
    sortableColumns: {
      id: "id",
      nome: "nome"
    },
    options: {
      labelField: "nome"
    }
  },
  errors: true
});

class CrudFactoryService {
  async list(_ctx: RequestContext<unknown, InstanceType<typeof crudDtos.queryDto>>) {
    return { items: [], total: 0, page: 1, pageSize: 25 } as InstanceType<typeof crudDtos.pagedResponseDto>;
  }

  async options(_ctx: RequestContext<unknown, InstanceType<typeof crudDtos.optionsQueryDto>>) {
    return { items: [], total: 0, page: 1, pageSize: 25 } as InstanceType<typeof crudDtos.optionsDto>;
  }

  async getById(
    id: number,
    _ctx: RequestContext<unknown, undefined, InstanceType<typeof crudDtos.params>>
  ) {
    return { id, nome: "Teste", ativo: true } as InstanceType<typeof crudDtos.response>;
  }

  async create(
    body: InstanceType<typeof crudDtos.create>,
    _ctx: RequestContext<InstanceType<typeof crudDtos.create>>
  ) {
    return { id: 1, ...body } as InstanceType<typeof crudDtos.response>;
  }

  async replace(
    id: number,
    body: InstanceType<typeof crudDtos.replace>,
    _ctx: RequestContext<InstanceType<typeof crudDtos.replace>, undefined, InstanceType<typeof crudDtos.params>>
  ) {
    return { id, ...body } as InstanceType<typeof crudDtos.response>;
  }

  async update(
    id: number,
    body: InstanceType<typeof crudDtos.update>,
    _ctx: RequestContext<InstanceType<typeof crudDtos.update>, undefined, InstanceType<typeof crudDtos.params>>
  ) {
    return { id, ...body } as InstanceType<typeof crudDtos.response>;
  }

  async delete(
    _id: number,
    _ctx: RequestContext<unknown, undefined, InstanceType<typeof crudDtos.params>>
  ) {}
}

const CrudFactoryController = createCrudController({
  path: "/crud-factory",
  service: CrudFactoryService,
  dtos: crudDtos,
  entityName: "CrudFactoryEntity"
});

describe("createCrudController", () => {
  it("registers CRUD routes with expected schemas and statuses", () => {
    const meta = getControllerMeta(CrudFactoryController);
    expect(meta).toBeDefined();
    expect(meta?.basePath).toBe("/crud-factory");

    const routeKeys = (meta?.routes ?? [])
      .map((route) => `${route.httpMethod} ${route.path}`)
      .sort();

    expect(routeKeys).toEqual([
      "delete /:id",
      "get /",
      "get /:id",
      "get /options",
      "patch /:id",
      "post /",
      "put /:id"
    ]);

    const byKey = new Map(
      (meta?.routes ?? []).map((route) => [`${route.httpMethod} ${route.path}`, route] as const)
    );

    const listRoute = byKey.get("get /");
    expect(listRoute?.query?.schema).toBe(crudDtos.queryDto);
    expect(listRoute?.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 200, schema: crudDtos.pagedResponseDto })
      ])
    );

    const optionsRoute = byKey.get("get /options");
    expect(optionsRoute?.query?.schema).toBe(crudDtos.optionsQueryDto);
    expect(optionsRoute?.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 200, schema: crudDtos.optionsDto })
      ])
    );

    const createRoute = byKey.get("post /");
    expect(createRoute?.body?.schema).toBe(crudDtos.create);
    expect(createRoute?.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 201, schema: crudDtos.response })
      ])
    );

    for (const key of ["get /:id", "put /:id", "patch /:id", "delete /:id"]) {
      const route = byKey.get(key);
      expect(route?.params?.schema).toBe(crudDtos.params);
      expect(route?.responses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 400, error: true }),
          expect.objectContaining({ status: 404, error: true })
        ])
      );
    }

    expect(byKey.get("put /:id")?.body?.schema).toBe(crudDtos.replace);
    expect(byKey.get("patch /:id")?.body?.schema).toBe(crudDtos.update);
    expect(byKey.get("delete /:id")?.responses).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 204 })])
    );
  });

  it("exposes matching schemas/status in OpenAPI", () => {
    const doc = buildOpenApi({
      info: { title: "Test API", version: "1.0.0" },
      controllers: [CrudFactoryController]
    });

    const listResponses = (doc.paths["/crud-factory"]?.get as Record<string, any>)?.responses;
    const createResponses = (doc.paths["/crud-factory"]?.post as Record<string, any>)?.responses;
    const getByIdResponses = (doc.paths["/crud-factory/{id}"]?.get as Record<string, any>)?.responses;
    const deleteResponses = (doc.paths["/crud-factory/{id}"]?.delete as Record<string, any>)?.responses;

    expect(listResponses?.["200"]).toBeDefined();
    expect(createResponses?.["201"]).toBeDefined();
    expect(getByIdResponses?.["200"]).toBeDefined();
    expect(getByIdResponses?.["400"]).toBeDefined();
    expect(getByIdResponses?.["404"]).toBeDefined();
    expect(deleteResponses?.["204"]).toBeDefined();
  });

  it("supports disabling optional routes with flags", () => {
    const MinimalController = createCrudController({
      path: "/crud-factory-minimal",
      service: new CrudFactoryService(),
      dtos: crudDtos,
      entityName: "CrudFactoryEntity",
      withOptionsRoute: false,
      withReplace: false,
      withPatch: false,
      withDelete: false
    });

    const meta = getControllerMeta(MinimalController);
    const routeKeys = (meta?.routes ?? [])
      .map((route) => `${route.httpMethod} ${route.path}`)
      .sort();

    expect(routeKeys).toEqual([
      "get /",
      "get /:id",
      "post /"
    ]);
  });

  it("uses entityName in parseIdOrThrow messages", async () => {
    const controller = new CrudFactoryController();
    await expect(
      controller.getById({
        params: { id: "invalid" }
      } as any)
    ).rejects.toMatchObject({
      status: 400,
      message: "Invalid CrudFactoryEntity id."
    });
  });
});
