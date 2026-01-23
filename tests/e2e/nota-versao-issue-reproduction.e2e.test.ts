import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMetalCrudDtoClasses, buildOpenApi, Controller, Get, Post, Body, Returns, Query, createPagedResponseDtoClass, createPagedFilterQueryDtoClass, t } from '../../src/index';
import { Entity, Column, PrimaryKey, col } from 'metal-orm';
import { getDtoMeta } from '../../src/core/metadata';

describe('e2e: NotaVersao exact scenario from issue', () => {
  
  describe('Pattern 1: Entity and DTOs in same file (working)', () => {
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

    it('should correctly load entity metadata and create DTOs', () => {
      const notaVersaoCrud = createMetalCrudDtoClasses(NotaVersao, {
        response: { description: 'Nota de versão retornada pela API.' },
        mutationExclude: ['id', 'data_exclusao', 'data_inativacao'],
      });

      const responseMeta = getDtoMeta(notaVersaoCrud.response);
      expect(responseMeta).toBeDefined();
      expect(Object.keys(responseMeta?.fields || {})).toEqual([
        'id', 'data', 'sprint', 'ativo', 'mensagem', 'data_exclusao', 'data_inativacao'
      ]);

      const createMeta = getDtoMeta(notaVersaoCrud.create);
      expect(createMeta).toBeDefined();
      expect(Object.keys(createMeta?.fields || {})).toEqual([
        'data', 'sprint', 'ativo', 'mensagem'
      ]);
    });

    it('should generate complete OpenAPI spec with all fields', () => {
      const notaVersaoCrud = createMetalCrudDtoClasses(NotaVersao, {
        response: { description: 'Nota de versão retornada pela API.' },
        mutationExclude: ['id', 'data_exclusao', 'data_inativacao'],
      });

      const { response: NotaVersaoDto, create: CreateNotaVersaoDto } = notaVersaoCrud;

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
      }

      const doc = buildOpenApi({
        info: { 
          title: 'PGE Digital Backend API', 
          version: '1.0.0', 
          description: 'API for PGE Digital Backend' 
        },
        controllers: [NotaVersaoController]
      });

      const schemas = doc.components?.schemas;
      
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
    });
  });

  describe('Pattern 2: Entity defined without decorators (causes issue)', () => {
    let consoleWarnSpy: any;
    
    beforeAll(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockReturnValue();
    });

    afterAll(() => {
      consoleWarnSpy?.mockRestore();
    });

    class NotaVersaoBad {
      id!: number;
      data!: Date;
      sprint!: number;
      ativo!: boolean;
      mensagem!: string;
      data_exclusao?: Date;
      data_inativacao?: Date;
    }

    it('should create DTOs but with no fields (reproduces issue)', () => {
      const crud = createMetalCrudDtoClasses(NotaVersaoBad);
      const meta = getDtoMeta(crud.response);

      expect(meta).toBeDefined();
      expect(meta?.fields).toEqual({});
    });

    it('should generate empty schemas in OpenAPI (reproduces issue)', () => {
      const crud = createMetalCrudDtoClasses(NotaVersaoBad);

      @Controller({ path: '/nota-versao', tags: ['Nota Versão'] })
      class NotaVersaoController {
        @Get('/')
        @Returns(crud.response)
        async list() {
          return { items: [], total: 0, page: 1, pageSize: 25 };
        }
      }

      const doc = buildOpenApi({
        info: { title: 'PGE Digital Backend API', version: '1.0.0' },
        controllers: [NotaVersaoController]
      });

      const schemas = doc.components?.schemas;
      const schema = schemas?.[crud.response.name];
      
      expect(schema).toBeDefined();
      expect(schema?.properties).toEqual({});
    });
  });

  describe('Pattern 3: Entity with decorators applied after import (timing issue)', () => {
    let consoleWarnSpy: any;
    
    beforeAll(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockReturnValue();
    });

    afterAll(() => {
      consoleWarnSpy?.mockRestore();
    });

    class NotaVersaoTiming {
      id!: number;
      name!: string;
    }

    it('should fail when decorators are applied after DTO creation', () => {
      const crud = createMetalCrudDtoClasses(NotaVersaoTiming);
      const meta = getDtoMeta(crud.response);

      expect(meta?.fields).toEqual({});

      @Entity({ tableName: 'nota_versao' })
      class NotaVersaoAfter {
        @PrimaryKey(col.int())
        id!: number;
      }

      const crud2 = createMetalCrudDtoClasses(NotaVersaoAfter);
      const meta2 = getDtoMeta(crud2.response);
      
      expect(meta2?.fields).toBeDefined();
      expect(Object.keys(meta2?.fields || {})).toContain('id');
    });
  });

  describe('Pattern 4: Simulating circular dependency', () => {
    let consoleWarnSpy: any;
    
    beforeAll(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockReturnValue();
    });

    afterAll(() => {
      consoleWarnSpy?.mockRestore();
    });

    it('demonstrates the issue that circular imports can cause', () => {
      const EntityClass = class TestEntity {
        id!: number;
        name!: string;
      };

      @Entity({ tableName: 'test' })
      class ProperlyDecoratedEntity {
        @PrimaryKey(col.int())
        id!: number;
      }

      const crud1 = createMetalCrudDtoClasses(EntityClass);
      const meta1 = getDtoMeta(crud1.response);
      expect(meta1?.fields).toEqual({});

      const crud2 = createMetalCrudDtoClasses(ProperlyDecoratedEntity);
      const meta2 = getDtoMeta(crud2.response);
      expect(meta2?.fields).toBeDefined();
      expect(Object.keys(meta2?.fields || {})).toContain('id');
    });
  });

  describe('Pattern 5: Type-only import issue', () => {
    @Entity({ tableName: 'test_import' })
    class TestImportEntity {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.text())
      name!: string;
    }

    it('should work with value imports', () => {
      const { EntityClass } = { EntityClass: TestImportEntity };
      const crud = createMetalCrudDtoClasses(EntityClass);
      const meta = getDtoMeta(crud.response);

      expect(meta?.fields).toBeDefined();
      expect(Object.keys(meta?.fields || {})).toContain('id');
    });
  });

  describe('Best practices for NotaVersao implementation', () => {
    @Entity({ tableName: 'nota_versao' })
    class NotaVersaoBestPractice {
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

    it('should validate all fields are correctly mapped', () => {
      const crud = createMetalCrudDtoClasses(NotaVersaoBestPractice, {
        response: { description: 'Nota de versão retornada pela API.' },
        mutationExclude: ['id', 'data_exclusao', 'data_inativacao'],
      });

      const responseMeta = getDtoMeta(crud.response);
      const fields = responseMeta?.fields || {};

      expect(fields.id?.schema?.kind).toBe('integer');
      expect(fields.data?.schema?.kind).toBe('string');
      expect((fields.data?.schema as any)?.format).toBe('date');
      expect(fields.sprint?.schema?.kind).toBe('integer');
      expect(fields.ativo?.schema?.kind).toBe('boolean');
      expect(fields.mensagem?.schema?.kind).toBe('string');
      expect(fields.data_exclusao?.schema?.nullable).toBe(true);
      expect(fields.data_inativacao?.schema?.nullable).toBe(true);
    });

    it('should validate mutation DTOs exclude correct fields', () => {
      const crud = createMetalCrudDtoClasses(NotaVersaoBestPractice, {
        mutationExclude: ['id', 'data_exclusao', 'data_inativacao'],
      });

      const createMeta = getDtoMeta(crud.create);
      const createFields = createMeta?.fields || {};

      expect(Object.keys(createFields)).not.toContain('id');
      expect(Object.keys(createFields)).not.toContain('data_exclusao');
      expect(Object.keys(createFields)).not.toContain('data_inativacao');
      expect(Object.keys(createFields)).toContain('data');
      expect(Object.keys(createFields)).toContain('sprint');
      expect(Object.keys(createFields)).toContain('ativo');
      expect(Object.keys(createFields)).toContain('mensagem');
    });
  });
});
