import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { 
  createMetalCrudDtoClasses, 
  createPagedResponseDtoClass,
  createPagedFilterQueryDtoClass
} from '../../src/adapter/metal-orm/index';
import { buildOpenApi } from '../../src/core/openapi';
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Returns,
  Query,
  Params
} from '../../src/core/decorators';
import { t } from '../../src/core/schema';
import { Entity, Column, PrimaryKey, col, getColumnMap } from 'metal-orm';
import { getAllDtos, getDtoMeta } from '../../src/core/metadata';

describe('e2e: metadata loading and entity to DTO transformation', () => {
  
  describe('Scenario 1: Direct entity definition and DTO creation (baseline)', () => {
    @Entity({ tableName: 'test_entity_1' })
    class TestEntity1 {
      @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
      id!: number;

      @Column(col.notNull(col.text()))
      name!: string;

      @Column(col.notNull(col.int()))
      age!: number;

      @Column(col.boolean())
      active?: boolean;

      @Column(col.datetime<Date>())
      createdAt?: Date;
    }

    it('should load entity metadata from decorators', () => {
      const columns = getColumnMap(TestEntity1);
      expect(columns).toBeDefined();
      expect(Object.keys(columns || {})).toEqual([
        'id', 'name', 'age', 'active', 'createdAt'
      ]);
      expect(columns?.id).toMatchObject({
        type: 'INT',
        primary: true,
        autoIncrement: true,
      });
    });

    it('should create CRUD DTOs from entity with all fields', () => {
      const crud = createMetalCrudDtoClasses(TestEntity1, {
        response: { description: 'Response DTO' }
      });

      expect(crud.response).toBeDefined();
      expect(crud.create).toBeDefined();
      expect(crud.replace).toBeDefined();
      expect(crud.update).toBeDefined();
      expect(crud.params).toBeDefined();
    });

    it('should register DTO metadata for all CRUD types', () => {
      const crud = createMetalCrudDtoClasses(TestEntity1);
      
      const responseMeta = getDtoMeta(crud.response);
      expect(responseMeta).toBeDefined();
      expect(responseMeta?.fields).toBeDefined();
      expect(Object.keys(responseMeta?.fields || {})).toContain('id');
      expect(Object.keys(responseMeta?.fields || {})).toContain('name');
      
      const createMeta = getDtoMeta(crud.create);
      expect(createMeta).toBeDefined();
      expect(createMeta?.fields).toBeDefined();
    });

    it('should exclude specified fields from mutation DTOs', () => {
      const crud = createMetalCrudDtoClasses(TestEntity1, {
        mutationExclude: ['id', 'createdAt']
      });

      const createMeta = getDtoMeta(crud.create);
      expect(createMeta?.fields).toBeDefined();
      expect(Object.keys(createMeta?.fields || {})).not.toContain('id');
      expect(Object.keys(createMeta?.fields || {})).not.toContain('createdAt');
      expect(Object.keys(createMeta?.fields || {})).toContain('name');
    });

    it('should generate correct OpenAPI schemas', () => {
      const crud = createMetalCrudDtoClasses(TestEntity1, {
        mutationExclude: ['id', 'createdAt']
      });

      const TestEntityQueryDtoClass = createPagedFilterQueryDtoClass({
        name: 'TestEntityQueryDto',
        filters: {
          name: { schema: t.string(), operator: 'contains' },
          active: { schema: t.boolean(), operator: 'equals' }
        }
      });

      const TestEntityPagedResponseDto = createPagedResponseDtoClass({
        name: 'TestEntityPagedResponseDto',
        itemDto: crud.response
      });

      @Controller({ path: '/test-entity', tags: ['Test Entity'] })
      class TestEntityController {
        @Get('/')
        @Query(TestEntityQueryDtoClass)
        @Returns(TestEntityPagedResponseDto)
        async list() {
          return { items: [], total: 0, page: 1, pageSize: 25 };
        }

        @Post('/')
        @Body(crud.create)
        @Returns({ status: 201, schema: crud.response })
        async create() {
          return {} as any;
        }
      }

      const doc = buildOpenApi({
        info: { title: 'Test API', version: '1.0.0' },
        controllers: [TestEntityController]
      });

      const schemas = doc.components?.schemas;
      expect(schemas).toBeDefined();
      
      const responseSchema = schemas?.[crud.response.name];
      expect(responseSchema).toBeDefined();
      expect(responseSchema?.properties).toBeDefined();
      expect(Object.keys(responseSchema?.properties || {})).toContain('id');
      expect(Object.keys(responseSchema?.properties || {})).toContain('name');
      
      const createSchema = schemas?.[crud.create.name];
      expect(createSchema).toBeDefined();
      expect(Object.keys(createSchema?.properties || {})).not.toContain('id');
    });
  });

  describe('Scenario 2: Entity defined in separate file (import scenario)', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    afterAll(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should handle entity imported from separate module', () => {
      @Entity({ tableName: 'test_entity_2' })
      class TestEntity2 {
        @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
        id!: number;

        @Column(col.notNull(col.text()))
        title!: string;
      }

      const crud = createMetalCrudDtoClasses(TestEntity2);
      const meta = getDtoMeta(crud.response);

      expect(meta).toBeDefined();
      expect(meta?.fields).toBeDefined();
      expect(Object.keys(meta?.fields || {})).toContain('id');
      expect(Object.keys(meta?.fields || {})).toContain('title');

      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('has no columns')
      );
    });
  });

  describe('Scenario 3: Multiple DTOs created from same entity', () => {
    @Entity({ tableName: 'test_entity_3' })
    class TestEntity3 {
      @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
      id!: number;

      @Column(col.notNull(col.text()))
      description!: string;

      @Column(col.notNull(col.int()))
      quantity!: number;
    }

    it('should allow multiple DTO configurations from same entity', () => {
      const crud1 = createMetalCrudDtoClasses(TestEntity3, {
        mutationExclude: ['id']
      });

      const crud2 = createMetalCrudDtoClasses(TestEntity3, {
        mutationExclude: ['id', 'quantity']
      });

      getDtoMeta(crud1.create);
      const meta2 = getDtoMeta(crud2.response);
      expect(meta2?.fields).toBeDefined();
      expect(Object.keys(meta2?.fields || {})).toContain('id');
      expect(meta2?.fields?.quantity).toBeDefined();
      expect(meta2?.fields?.quantity?.schema?.nullable).not.toBe(true);
    });
  });

  describe('Scenario 4: Entity with complex column types', () => {
    @Entity({ tableName: 'test_entity_4' })
    class TestEntity4 {
      @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
      id!: number;

      @Column(col.notNull(col.date<Date>()))
      dateField!: Date;

      @Column(col.notNull(col.datetime<Date>()))
      datetimeField!: Date;

      @Column(col.notNull(col.text()))
      textField!: string;

      @Column(col.notNull(col.int()))
      intField!: number;

      @Column(col.notNull(col.float()))
      floatField!: number;

      @Column(col.notNull(col.boolean()))
      boolField!: boolean;

      @Column(col.json())
      jsonField?: any;
    }

    it('should create DTOs with correct schema types for all column types', () => {
      const crud = createMetalCrudDtoClasses(TestEntity4);
      const meta = getDtoMeta(crud.response);

      expect(meta?.fields).toBeDefined();
      expect(meta?.fields?.floatField?.schema).toMatchObject({
        kind: 'number'
      });
      expect(meta?.fields?.boolField?.schema).toMatchObject({
        kind: 'boolean'
      });
      expect(meta?.fields?.dateField?.schema).toMatchObject({
        kind: 'string',
        format: 'date'
      });
      expect(meta?.fields?.intField?.schema).toMatchObject({
        kind: 'integer'
      });
    });
  });

  describe('Scenario 5: Entity with no columns (edge case)', () => {
    let consoleWarnSpy: any;
    
    beforeAll(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockReturnValue();
    });

    afterAll(() => {
      consoleWarnSpy?.mockRestore();
    });

    it('should create DTOs with empty fields when entity has no columns', () => {
      @Entity({ tableName: 'test_entity_5' })
      class TestEntity5 {
      }

      const crud = createMetalCrudDtoClasses(TestEntity5);
      const meta = getDtoMeta(crud.response);

      expect(meta).toBeDefined();
      expect(meta?.fields).toEqual({});
    });
  });

  describe('Scenario 6: Entity decorators applied after DTO creation (timing issue)', () => {
    let consoleWarnSpy: any;
    
    beforeAll(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockReturnValue();
    });

    afterAll(() => {
      consoleWarnSpy?.mockRestore();
    });

    it('should create DTOs with empty fields when entity lacks proper decorators', () => {
      class TestEntity6 {
        id!: number;
        name!: string;
      }

      const crud = createMetalCrudDtoClasses(TestEntity6);
      const meta = getDtoMeta(crud.response);

      expect(meta).toBeDefined();
      expect(meta?.fields).toEqual({});
    });
  });

  describe('Scenario 7: DTOs registered in global metadata store', () => {
    @Entity({ tableName: 'test_entity_7' })
    class TestEntity7 {
      @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
      id!: number;

      @Column(col.notNull(col.text()))
      label!: string;
    }

    it('should make DTOs accessible via getAllDtos', () => {
      const initialCount = getAllDtos().length;

      const crud = createMetalCrudDtoClasses(TestEntity7);

      expect(getAllDtos().length).toBeGreaterThan(initialCount);
      const allDtos = getAllDtos();
      const dtoClasses = allDtos.map(([dto]) => dto);
      expect(dtoClasses).toContain(crud.response);
      expect(dtoClasses).toContain(crud.create);
      expect(dtoClasses).toContain(crud.replace);
      expect(dtoClasses).toContain(crud.update);
      expect(dtoClasses).toContain(crud.params);
    });

    it('should retrieve correct metadata for each registered DTO', () => {
      const crud = createMetalCrudDtoClasses(TestEntity7);

      const allDtos = getAllDtos();
      
      const responseMeta = allDtos.find(([dto]) => dto === crud.response)?.[1];
      expect(responseMeta).toBeDefined();
      expect(responseMeta?.fields).toBeDefined();
      
      const createMeta = allDtos.find(([dto]) => dto === crud.create)?.[1];
      expect(createMeta).toBeDefined();
      expect(createMeta?.fields).toBeDefined();
    });
  });

  describe('Scenario 8: Complete OpenAPI generation with full CRUD operations', () => {
    @Entity({ tableName: 'products' })
    class Product {
      @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
      id!: number;

      @Column(col.notNull(col.text()))
      name!: string;

      @Column(col.notNull(col.float()))
      price!: number;

      @Column(col.notNull(col.boolean()))
      available!: boolean;

      @Column(col.text())
      description?: string;

      @Column(col.datetime<Date>())
      createdAt?: Date;

      @Column(col.datetime<Date>())
      updatedAt?: Date;
    }

    it('should generate complete OpenAPI spec with all CRUD endpoints', () => {
      const productCrud = createMetalCrudDtoClasses(Product, {
        mutationExclude: ['id', 'createdAt', 'updatedAt']
      });

      const ProductQueryDtoClass = createPagedFilterQueryDtoClass({
        name: 'ProductQueryDto',
        filters: {
          name: { schema: t.string(), operator: 'contains' },
          available: { schema: t.boolean(), operator: 'equals' }
        }
      });

      const ProductPagedResponseDto = createPagedResponseDtoClass({
        name: 'ProductPagedResponseDto',
        itemDto: productCrud.response
      });

      @Controller({ path: '/products', tags: ['Products'] })
      class ProductController {
        @Get('/')
        @Query(ProductQueryDtoClass)
        @Returns(ProductPagedResponseDto)
        async list() {
          return { items: [], total: 0, page: 1, pageSize: 25 };
        }

        @Get('/:id')
        @Returns(productCrud.response)
        async getById() {
          return {} as any;
        }

        @Post('/')
        @Body(productCrud.create)
        @Returns({ status: 201, schema: productCrud.response })
        async create() {
          return {} as any;
        }

        @Put('/:id')
        @Body(productCrud.replace)
        @Returns(productCrud.response)
        async replace() {
          return {} as any;
        }

        @Patch('/:id')
        @Body(productCrud.update)
        @Returns(productCrud.response)
        async update() {
          return {} as any;
        }

        @Delete('/:id')
        @Returns(productCrud.response)
        async delete() {
          return {} as any;
        }
      }

      const doc = buildOpenApi({
        info: { 
          title: 'Product API', 
          version: '1.0.0',
          description: 'API for managing products'
        },
        controllers: [ProductController]
      });

      expect(doc.openapi).toBe('3.1.0');
      expect(doc.info.title).toBe('Product API');
      expect(doc.paths).toBeDefined();
      expect(doc.paths['/products']).toBeDefined();
      expect(doc.paths['/products']?.get).toBeDefined();
      expect(doc.paths['/products']?.post).toBeDefined();
      expect(doc.paths['/products/{id}'])?.toBeDefined();
      expect(doc.paths['/products/{id}']?.get).toBeDefined();
      expect(doc.paths['/products/{id}']?.put).toBeDefined();
      expect(doc.paths['/products/{id}']?.patch).toBeDefined();
      expect(doc.paths['/products/{id}']?.delete).toBeDefined();

      const schemas = doc.components?.schemas;
      expect(schemas).toBeDefined();
      expect(schemas?.[productCrud.response.name]).toBeDefined();
      expect(schemas?.[productCrud.create.name]).toBeDefined();
      expect(schemas?.[productCrud.replace.name]).toBeDefined();
      expect(schemas?.[productCrud.update.name]).toBeDefined();

      const productDto = schemas?.[productCrud.response.name];
      const productDtoMeta = getDtoMeta(productCrud.response);
      expect(productDtoMeta?.fields).toBeDefined();
      expect(Object.keys(productDtoMeta?.fields || {})).toEqual([
        'id', 'name', 'price', 'available', 'description', 'createdAt', 'updatedAt'
      ]);

      expect(productDtoMeta?.fields?.price?.schema).toMatchObject({
        kind: 'number'
      });
      expect(productDtoMeta?.fields?.available?.schema).toMatchObject({
        kind: 'boolean'
      });
      if (productDto && 'properties' in productDto) {
        expect((productDto as any).properties?.available).toMatchObject({
          type: 'boolean'
        });
      }
    });
  });

  describe('Scenario 9: Field metadata validation', () => {
    @Entity({ tableName: 'test_entity_9' })
    class TestEntity9 {
      @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
      id!: number;

      @Column(col.notNull(col.text()))
      requiredField!: string;

      @Column(col.text())
      optionalField?: string;

      @Column(col.notNull(col.int()))
      requiredNumber!: number;

      @Column(col.int())
      optionalNumber?: number;
    }

    it('should preserve nullable/required information from columns', () => {
      const crud = createMetalCrudDtoClasses(TestEntity9);
      const meta = getDtoMeta(crud.response);

      expect(meta?.fields?.requiredField?.schema?.nullable).not.toBe(true);
      expect(meta?.fields?.optionalField?.schema?.nullable).toBe(true);
      expect(meta?.fields?.requiredNumber?.schema?.nullable).not.toBe(true);
      expect(meta?.fields?.optionalNumber?.schema?.nullable).toBe(true);
    });
  });

  describe('Scenario 10: Entity with all possible column configurations', () => {
    @Entity({ tableName: 'comprehensive_test' })
    class ComprehensiveEntity {
      @PrimaryKey(col.notNull(col.autoIncrement(col.int())))
      id!: number;

      @Column(col.notNull(col.text()))
      nonNullableText!: string;

      @Column(col.text())
      nullableText?: string;

      @Column(col.notNull(col.int()))
      nonNullableInt!: number;

      @Column(col.int())
      nullableInt?: number;

      @Column(col.notNull(col.float()))
      nonNullableFloat!: number;

      @Column(col.float())
      nullableFloat?: number;

      @Column(col.notNull(col.boolean()))
      nonNullableBool!: boolean;

      @Column(col.boolean())
      nullableBool?: boolean;

      @Column(col.notNull(col.date<Date>()))
      nonNullableDate!: Date;

      @Column(col.date<Date>())
      nullableDate?: Date;

      @Column(col.notNull(col.datetime<Date>()))
      nonNullableDatetime!: Date;

      @Column(col.datetime<Date>())
      nullableDatetime?: Date;

      @Column(col.json())
      jsonField?: any;
    }

    it('should correctly map all column types to schema types', () => {
      const crud = createMetalCrudDtoClasses(ComprehensiveEntity);
      const meta = getDtoMeta(crud.response);

      const fields = meta?.fields || {};
      
      expect(fields.id?.schema).toMatchObject({ kind: 'integer' });
      expect(fields.nonNullableText?.schema).toMatchObject({ kind: 'string' });
      expect(fields.nullableText?.schema).toMatchObject({ kind: 'string', nullable: true });
      expect(fields.nonNullableInt?.schema).toMatchObject({ kind: 'integer' });
      expect(fields.nullableInt?.schema).toMatchObject({ kind: 'integer', nullable: true });
      expect(fields.nonNullableFloat?.schema).toMatchObject({ kind: 'number' });
      expect(fields.nullableFloat?.schema).toMatchObject({ kind: 'number', nullable: true });
      expect(fields.nonNullableBool?.schema).toMatchObject({ kind: 'boolean' });
      expect(fields.nullableBool?.schema).toMatchObject({ kind: 'boolean', nullable: true });
      expect(fields.nonNullableDate?.schema).toMatchObject({ kind: 'string', format: 'date' });
      expect(fields.nullableDate?.schema).toMatchObject({ kind: 'string', format: 'date', nullable: true });
      expect(fields.nonNullableDatetime?.schema).toMatchObject({ kind: 'string', format: 'date-time' });
      expect(fields.nullableDatetime?.schema).toMatchObject({ kind: 'string', format: 'date-time', nullable: true });
    });

    it('should generate valid OpenAPI schemas for all fields', () => {
      const crud = createMetalCrudDtoClasses(ComprehensiveEntity, {
        mutationExclude: ['id']
      });

      @Controller({ path: '/comprehensive', tags: ['Comprehensive'] })
      class ComprehensiveController {
        @Post('/')
        @Body(crud.create)
        @Returns({ status: 201, schema: crud.response })
        async create() {
          return {} as any;
        }
      }

      const doc = buildOpenApi({
        info: { title: 'Comprehensive Test API', version: '1.0.0' },
        controllers: [ComprehensiveController]
      });

      const schemas = doc.components?.schemas;
      const createSchema = schemas?.[crud.create.name];
      
      expect(createSchema?.properties).toBeDefined();
      expect(Object.keys(createSchema?.properties || {})).not.toContain('id');
      expect(Object.keys(createSchema?.properties || {})).toContain('nonNullableText');
      expect(Object.keys(createSchema?.properties || {})).toContain('nullableText');
      expect(Object.keys(createSchema?.properties || {})).toContain('jsonField');
    });
  });

  describe('Root cause analysis - NotaVersao reproduction', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    afterAll(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should correctly handle NotaVersao entity (reproducing original issue)', () => {
      @Entity({ tableName: 'nota_versao' })
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
        response: { description: 'Nota de versão retornada pela API.' },
        mutationExclude: ['id', 'data_exclusao', 'data_inativacao'],
      });

      const {
        response: NotaVersaoDto,
        create: CreateNotaVersaoDto,
        replace: ReplaceNotaVersaoDto,
        update: UpdateNotaVersaoDto,
        params: NotaVersaoParamsDto,
      } = notaVersaoCrud;

      const NotaVersaoQueryDtoClass = createPagedFilterQueryDtoClass({
        name: 'NotaVersaoQueryDto',
        filters: {
          sprint: { schema: t.integer({ minimum: 1 }), operator: 'equals' },
          ativo: { schema: t.boolean(), operator: 'equals' },
          mensagemContains: { schema: t.string({ minLength: 1 }), operator: 'contains' },
        },
      });

      const NotaVersaoPagedResponseDto = createPagedResponseDtoClass({
        name: 'NotaVersaoPagedResponseDto',
        itemDto: NotaVersaoDto,
        description: 'Lista paginada de notas de versão.',
      });

      @Controller({ path: '/nota-versao', tags: ['Nota Versão'] })
      class NotaVersaoController {
        @Get('/')
        @Query(NotaVersaoQueryDtoClass)
        @Returns(NotaVersaoPagedResponseDto)
        async list() {
          return { items: [], total: 0, page: 1, pageSize: 25 };
        }

        @Post('/')
        @Body(CreateNotaVersaoDto)
        @Returns({ status: 201, schema: NotaVersaoDto })
        async create() {
          return {} as any;
        }

        @Get('/:id')
        @Params(NotaVersaoParamsDto)
        @Returns(NotaVersaoDto)
        async getById() {
          return {} as any;
        }

        @Put('/:id')
        @Params(NotaVersaoParamsDto)
        @Body(ReplaceNotaVersaoDto)
        @Returns(NotaVersaoDto)
        async replace() {
          return {} as any;
        }

        @Patch('/:id')
        @Params(NotaVersaoParamsDto)
        @Body(UpdateNotaVersaoDto)
        @Returns(NotaVersaoDto)
        async update() {
          return {} as any;
        }

        @Delete('/:id')
        @Params(NotaVersaoParamsDto)
        @Returns(NotaVersaoDto)
        async softDelete() {
          return {} as any;
        }

        @Patch('/:id/inativar')
        @Params(NotaVersaoParamsDto)
        @Returns(NotaVersaoDto)
        async inativar() {
          return {} as any;
        }

        @Patch('/:id/ativar')
        @Params(NotaVersaoParamsDto)
        @Returns(NotaVersaoDto)
        async ativar() {
          return {} as any;
        }
      }

      const doc = buildOpenApi({
        info: { title: 'PGE Digital Backend API', version: '1.0.0', description: 'API for PGE Digital Backend' },
        controllers: [NotaVersaoController]
      });

      const schemas = doc.components?.schemas;

      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('has no columns')
      );

      expect(schemas?.NotaVersaoDto).toBeDefined();
      expect(schemas?.NotaVersaoDto?.properties).toBeDefined();
      expect(Object.keys(schemas?.NotaVersaoDto?.properties || {})).toEqual([
        'id', 'data', 'sprint', 'ativo', 'mensagem', 'data_exclusao', 'data_inativacao'
      ]);

      expect(schemas?.CreateNotaVersaoDto).toBeDefined();
      expect(schemas?.CreateNotaVersaoDto?.properties).toBeDefined();
      expect(Object.keys(schemas?.CreateNotaVersaoDto?.properties || {})).toEqual([
        'data', 'sprint', 'ativo', 'mensagem'
      ]);

      expect(schemas?.NotaVersaoPagedResponseDto).toBeDefined();
      
      expect(doc.paths?.['/nota-versao']?.get).toBeDefined();
      expect(doc.paths?.['/nota-versao']?.post).toBeDefined();
      expect(doc.paths?.['/nota-versao/{id}'])?.toBeDefined();
      expect(doc.paths?.['/nota-versao/{id}']?.get).toBeDefined();
      expect(doc.paths?.['/nota-versao/{id}']?.put).toBeDefined();
      expect(doc.paths?.['/nota-versao/{id}']?.patch).toBeDefined();
      expect(doc.paths?.['/nota-versao/{id}']?.delete).toBeDefined();
      expect(doc.paths?.['/nota-versao/{id}/inativar']?.patch).toBeDefined();
      expect(doc.paths?.['/nota-versao/{id}/ativar']?.patch).toBeDefined();
    });
  });
});
