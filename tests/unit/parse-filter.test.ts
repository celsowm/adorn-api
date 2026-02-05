import { describe, expect, it } from "vitest";
import { parseFilter } from "../../src/adapter/metal-orm/index";

describe("parseFilter", () => {
  it("returns undefined when query is undefined", () => {
    const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
    const result = parseFilter<{ name: string }, "name">(undefined, mappings);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no matching query keys", () => {
    const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
    const result = parseFilter<{ name: string }, "name">({ unknown: "value" }, mappings);
    expect(result).toBeUndefined();
  });

  it("builds filter with contains operator", () => {
    const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
    const result = parseFilter<{ name: string }, "name">({ nameContains: "John" }, mappings);
    expect(result).toEqual({ name: { contains: "John" } });
  });

  it("builds filter with equals operator", () => {
    const mappings = { userId: { field: "userId" as const, operator: "equals" as const } };
    const result = parseFilter<{ userId: number }, "userId">({ userId: 123 }, mappings);
    expect(result).toEqual({ userId: { equals: 123 } });
  });

  it("builds filter with multiple fields", () => {
    const mappings = {
      nameContains: { field: "name" as const, operator: "contains" as const },
      userId: { field: "userId" as const, operator: "equals" as const }
    };
    const result = parseFilter<{ name: string; userId: number }, "name" | "userId">(
      { nameContains: "John", userId: 123 },
      mappings
    );
    expect(result).toEqual({ name: { contains: "John" }, userId: { equals: 123 } });
  });

  it("builds nested relation filters from field paths", () => {
    const mappings = {
      postTitleContains: { field: "posts.some.title", operator: "contains" as const }
    };
    const result = parseFilter<{ posts: unknown }, "posts">(
      { postTitleContains: "Hello" },
      mappings
    );
    expect(result).toEqual({ posts: { some: { title: { contains: "Hello" } } } });
  });

  it("reads nested query values by path", () => {
    const mappings = {
      "posts.titleContains": { field: "posts.some.title", operator: "contains" as const }
    };
    const result = parseFilter<{ posts: unknown }, "posts">(
      { posts: { titleContains: "Hello" } },
      mappings
    );
    expect(result).toEqual({ posts: { some: { title: { contains: "Hello" } } } });
  });

  it("supports relation-level operators", () => {
    const mappings = { postsEmpty: { field: "posts", operator: "isEmpty" as const } };
    const result = parseFilter<{ posts: unknown }, "posts">({ postsEmpty: true }, mappings);
    expect(result).toEqual({ posts: { isEmpty: true } });
  });

  it("Acervo -> pesquisadorTitular (BelongsTo) -> nome: no 'some' needed", () => {
    // Real scenario from user's codebase:
    // Acervo has @BelongsTo pesquisadorTitular -> Usuario
    // Usuario has nome field
    // BelongsTo is a to-one relation, so NO "some" quantifier is needed
    const mappings = {
      pesquisadorNomeContains: {
        field: "pesquisadorTitular.nome", // Correct: no "some" for BelongsTo
        operator: "contains" as const
      }
    };
    const result = parseFilter<{ pesquisadorTitular: unknown }, "pesquisadorTitular">(
      { pesquisadorNomeContains: "João" },
      mappings
    );
    // Correct filter structure for BelongsTo relation
    expect(result).toEqual({
      pesquisadorTitular: {
        nome: { contains: "João" }
      }
    });
  });

  it("Acervo -> processosAdministrativos (HasMany) -> titulo: needs 'some'", () => {
    // Acervo has @HasMany processosAdministrativos -> ProcessoAdministrativo
    // HasMany is a to-many relation, so "some" quantifier IS needed
    const mappings = {
      processoTituloContains: {
        field: "processosAdministrativos.some.titulo", // "some" required for HasMany
        operator: "contains" as const
      }
    };
    const result = parseFilter<{ processosAdministrativos: unknown }, "processosAdministrativos">(
      { processoTituloContains: "Processo" },
      mappings
    );
    expect(result).toEqual({
      processosAdministrativos: {
        some: {
          titulo: { contains: "Processo" }
        }
      }
    });
  });

  it("auto-inserting 'some' breaks BelongsTo: pesquisadorTitular.some.nome is INVALID", () => {
    // This proves the AI suggestion is WRONG
    // If we auto-inserted "some" for pesquisadorTitular.nome, we'd get:
    // pesquisadorTitular.some.nome - INVALID because BelongsTo doesn't support "some"

    // Correct: BelongsTo uses direct nesting
    const correctMappings = {
      pesquisadorNome: { field: "pesquisadorTitular.nome", operator: "equals" as const }
    };
    const correctResult = parseFilter<{ pesquisadorTitular: unknown }, "pesquisadorTitular">(
      { pesquisadorNome: "Maria" },
      correctMappings
    );
    expect(correctResult).toEqual({
      pesquisadorTitular: { nome: { equals: "Maria" } }
    });

    // WRONG: What the AI suggestion would produce (auto-inserting "some")
    // This would cause Metal-ORM runtime error: "some" is not valid for BelongsTo
    const wrongResult = {
      pesquisadorTitular: { some: { nome: { equals: "Maria" } } }
    };
    expect(correctResult).not.toEqual(wrongResult);
  });

  it("Usuario -> especializada (BelongsTo) -> nome: no 'some' needed", () => {
    // Usuario has @BelongsTo especializada -> Especializada
    const mappings = {
      especializadaNome: { field: "especializada.nome", operator: "equals" as const }
    };
    const result = parseFilter<{ especializada: unknown }, "especializada">(
      { especializadaNome: "Criminal" },
      mappings
    );
    // BelongsTo: direct nesting, no "some"
    expect(result).toEqual({
      especializada: { nome: { equals: "Criminal" } }
    });
    // NOT this (what auto-insert would produce):
    expect(result).not.toEqual({
      especializada: { some: { nome: { equals: "Criminal" } } }
    });
  });

  it("Usuario -> perfis (BelongsToMany) -> nome: needs 'some'", () => {
    // Usuario has @BelongsToMany perfis -> Perfil (many-to-many via pivot table)
    // BelongsToMany is also a to-many relation, so "some" IS needed
    const mappings = {
      perfilNome: { field: "perfis.some.nome", operator: "equals" as const }
    };
    const result = parseFilter<{ perfis: unknown }, "perfis">(
      { perfilNome: "Admin" },
      mappings
    );
    expect(result).toEqual({
      perfis: { some: { nome: { equals: "Admin" } } }
    });
  });

  it("ignores empty string values", () => {
    const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
    const result = parseFilter<{ name: string }, "name">({ nameContains: "" }, mappings);
    expect(result).toBeUndefined();
  });

  it("ignores null values", () => {
    const mappings = { nameContains: { field: "name" as const, operator: "contains" as const } };
    const result = parseFilter<{ name: string }, "name">({ nameContains: null }, mappings);
    expect(result).toBeUndefined();
  });
});
