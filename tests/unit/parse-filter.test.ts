import { describe, expect, it } from "vitest";
import { parseFilter } from "../../src/adapter/metal-orm/index";
import type { FilterMapping } from "../../src/adapter/metal-orm/index";

describe("parseFilter", () => {
  it("returns undefined when query is undefined", () => {
    const mappings: Record<string, FilterMapping<{ name: string }>> = {
      nameContains: { field: "name", operator: "contains" as const }
    };
    const result = parseFilter<{ name: string }, "name">(undefined, mappings);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no matching query keys", () => {
    const mappings: Record<string, FilterMapping<{ name: string }>> = {
      nameContains: { field: "name", operator: "contains" as const }
    };
    const result = parseFilter<{ name: string }, "name">({ unknown: "value" }, mappings);
    expect(result).toBeUndefined();
  });

  it("builds filter with contains operator", () => {
    const mappings: Record<string, FilterMapping<{ name: string }>> = {
      nameContains: { field: "name", operator: "contains" as const }
    };
    const result = parseFilter<{ name: string }, "name">({ nameContains: "John" }, mappings);
    expect(result).toEqual({ name: { contains: "John" } });
  });

  it("builds filter with equals operator", () => {
    const mappings: Record<string, FilterMapping<{ userId: number }>> = {
      userId: { field: "userId", operator: "equals" as const }
    };
    const result = parseFilter<{ userId: number }, "userId">({ userId: 123 }, mappings);
    expect(result).toEqual({ userId: { equals: 123 } });
  });

  it("builds filter with multiple fields", () => {
    const mappings: Record<string, FilterMapping<{ name: string; userId: number }>> = {
      nameContains: { field: "name", operator: "contains" as const },
      userId: { field: "userId", operator: "equals" as const }
    };
    const result = parseFilter<{ name: string; userId: number }, "name" | "userId">(
      { nameContains: "John", userId: 123 },
      mappings
    );
    expect(result).toEqual({ name: { contains: "John" }, userId: { equals: 123 } });
  });

  it("builds nested relation filters from field paths", () => {
    const mappings: Record<string, FilterMapping<{ posts: unknown }>> = {
      postTitleContains: { field: "posts.some.title", operator: "contains" as const }
    };
    const result = parseFilter<{ posts: unknown }, "posts">(
      { postTitleContains: "Hello" },
      mappings
    );
    expect(result).toEqual({ posts: { some: { title: { contains: "Hello" } } } });
  });

  it("reads nested query values by path", () => {
    const mappings: Record<string, FilterMapping<{ posts: unknown }>> = {
      "posts.titleContains": { field: "posts.some.title", operator: "contains" as const }
    };
    const result = parseFilter<{ posts: unknown }, "posts">(
      { posts: { titleContains: "Hello" } },
      mappings
    );
    expect(result).toEqual({ posts: { some: { title: { contains: "Hello" } } } });
  });

  it("supports relation-level operators", () => {
    const mappings: Record<string, FilterMapping<{ posts: unknown }>> = {
      postsEmpty: { field: "posts", operator: "isEmpty" as const }
    };
    const result = parseFilter<{ posts: unknown }, "posts">({ postsEmpty: true }, mappings);
    expect(result).toEqual({ posts: { isEmpty: true } });
  });

  it("Acervo -> pesquisadorTitular (BelongsTo) -> nome: requires quantifier", () => {
    // Real scenario from user's codebase:
    // Acervo has @BelongsTo pesquisadorTitular -> Usuario
    // Usuario has nome field
    // BelongsTo relations require a quantifier in Metal ORM
    const mappings: Record<string, FilterMapping<{ pesquisadorTitular: unknown }>> = {
      pesquisadorNomeContains: {
        field: "pesquisadorTitular.some.nome",
        operator: "contains" as const
      }
    };
    const result = parseFilter<{ pesquisadorTitular: unknown }, "pesquisadorTitular">(
      { pesquisadorNomeContains: "João" },
      mappings
    );
    expect(result).toEqual({
      pesquisadorTitular: {
        some: {
          nome: { contains: "João" }
        }
      }
    });
  });

  it("Acervo -> processosAdministrativos (HasMany) -> titulo: needs 'some'", () => {
    // Acervo has @HasMany processosAdministrativos -> ProcessoAdministrativo
    // HasMany is a to-many relation, so "some" quantifier IS needed
    const mappings: Record<string, FilterMapping<{ processosAdministrativos: unknown }>> = {
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

  it("BelongsTo filters use quantifiers instead of direct nesting", () => {
    const mappings: Record<string, FilterMapping<{ pesquisadorTitular: unknown }>> = {
      pesquisadorNome: { field: "pesquisadorTitular.some.nome", operator: "equals" as const }
    };
    const result = parseFilter<{ pesquisadorTitular: unknown }, "pesquisadorTitular">(
      { pesquisadorNome: "Maria" },
      mappings
    );
    expect(result).toEqual({
      pesquisadorTitular: { some: { nome: { equals: "Maria" } } }
    });
  });

  it("Usuario -> especializada (BelongsTo) -> nome: requires quantifier", () => {
    // Usuario has @BelongsTo especializada -> Especializada
    const mappings: Record<string, FilterMapping<{ especializada: unknown }>> = {
      especializadaNome: { field: "especializada.some.nome", operator: "equals" as const }
    };
    const result = parseFilter<{ especializada: unknown }, "especializada">(
      { especializadaNome: "Criminal" },
      mappings
    );
    expect(result).toEqual({
      especializada: { some: { nome: { equals: "Criminal" } } }
    });
  });

  it("Usuario -> perfis (BelongsToMany) -> nome: needs 'some'", () => {
    // Usuario has @BelongsToMany perfis -> Perfil (many-to-many via pivot table)
    // BelongsToMany is also a to-many relation, so "some" IS needed
    const mappings: Record<string, FilterMapping<{ perfis: unknown }>> = {
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
    const mappings: Record<string, FilterMapping<{ name: string }>> = {
      nameContains: { field: "name", operator: "contains" as const }
    };
    const result = parseFilter<{ name: string }, "name">({ nameContains: "" }, mappings);
    expect(result).toBeUndefined();
  });

  it("ignores null values", () => {
    const mappings: Record<string, FilterMapping<{ name: string }>> = {
      nameContains: { field: "name", operator: "contains" as const }
    };
    const result = parseFilter<{ name: string }, "name">({ nameContains: null }, mappings);
    expect(result).toBeUndefined();
  });
});
