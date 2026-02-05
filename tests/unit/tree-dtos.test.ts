import { describe, expect, it } from "vitest";
import { createMetalTreeDtoClasses } from "../../src/adapter/metal-orm/index";
import { Column, Entity, PrimaryKey, Tree, TreeChildren, TreeParent, col } from "metal-orm";
import { getDtoMeta } from "../../src/core/metadata";

describe("createMetalTreeDtoClasses", () => {
  @Entity({ tableName: "tree_entities" })
  @Tree({ parentKey: "parentId", leftKey: "lft", rightKey: "rght", depthKey: "depth" })
  class TreeEntity {
    @PrimaryKey(col.autoIncrement(col.int()))
    id!: number;

    @Column(col.notNull(col.text()))
    name!: string;

    @Column(col.int())
    parentId?: number | null;

    @Column(col.notNull(col.int()))
    lft!: number;

    @Column(col.notNull(col.int()))
    rght!: number;

    @Column(col.int())
    depth?: number | null;

    @TreeParent()
    parent?: TreeEntity;

    @TreeChildren()
    children?: TreeEntity[];
  }

  it("builds tree DTO classes with defaults", () => {
    const treeDtos = createMetalTreeDtoClasses(TreeEntity, {
      baseName: "TreeEntity"
    });

    const nodeMeta = getDtoMeta(treeDtos.node);
    const nodeResultMeta = getDtoMeta(treeDtos.nodeResult);
    const threadedMeta = getDtoMeta(treeDtos.threadedNode);
    const listEntryMeta = getDtoMeta(treeDtos.treeListEntry);

    expect(treeDtos.entity.name).toBe("TreeEntityDto");
    expect(treeDtos.node.name).toBe("TreeEntityNodeDto");
    expect(treeDtos.nodeResult.name).toBe("TreeEntityNodeResultDto");
    expect(treeDtos.threadedNode.name).toBe("TreeEntityThreadedNodeDto");

    expect(nodeMeta?.fields.entity).toBeDefined();
    expect(nodeMeta?.fields.lft).toBeDefined();
    expect(nodeMeta?.fields.rght).toBeDefined();
    expect(nodeMeta?.fields.childCount).toBeDefined();
    expect(nodeMeta?.fields.depth?.optional).toBe(true);

    expect(nodeResultMeta?.fields.data).toBeDefined();
    expect(nodeResultMeta?.fields.parentId).toBeDefined();
    expect(nodeResultMeta?.fields.depth?.optional).toBe(true);

    expect(threadedMeta?.fields.node).toBeDefined();
    expect((threadedMeta?.fields.children?.schema as any).kind).toBe("array");

    expect(listEntryMeta?.fields.key).toBeDefined();
    expect(listEntryMeta?.fields.value).toBeDefined();
    expect(listEntryMeta?.fields.depth).toBeDefined();
  });
});
