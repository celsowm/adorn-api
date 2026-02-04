import { getColumnMap, getTreeConfig } from "metal-orm";
import type { DtoConstructor } from "../../core/types";
import { t, type SchemaNode } from "../../core/schema";
import { registerDto, type FieldMeta } from "../../core/metadata";
import { MetalDto } from "./dto";
import type { FieldOverride } from "../../core/decorators";
import { buildFields } from "./field-builder";
import type {
  MetalTreeDtoClassOptions,
  MetalTreeDtoClasses,
  MetalTreeDtoClassNames
} from "./types";

export function createMetalTreeDtoClasses(
  target: any,
  options: MetalTreeDtoClassOptions = {}
): MetalTreeDtoClasses {
  const baseName = options.baseName ?? getTargetName(target);
  const names = resolveNames(baseName, options.names);
  const includeTreeMetadata = options.includeTreeMetadata ?? true;

  const entityDto = options.entityDto ?? createEntityDtoClass(target, {
    ...(options.entity ?? {}),
    name: names.entity
  });

  const nodeDto = createTreeNodeDtoClass(entityDto, {
    name: names.node,
    includeTreeMetadata
  });

  const parentKey = resolveParentKey(target, options.parentKey);
  const parentSchema = resolveParentSchema(target, parentKey, options.entity?.overrides, options.entity?.strict);

  const nodeResultDto = createTreeNodeResultDtoClass(entityDto, {
    name: names.nodeResult,
    includeTreeMetadata,
    parentSchema
  });

  const threadedNodeDto = createThreadedNodeDtoClass(entityDto, {
    name: names.threadedNode
  });

  const keySchema = options.treeListEntry?.keySchema
    ?? resolvePrimaryKeySchema(target, options.entity?.overrides, options.entity?.strict)
    ?? t.integer();

  const valueSchema = options.treeListEntry?.valueSchema ?? t.string();

  const treeListEntryDto = createTreeListEntryDtoClass({
    name: names.treeListEntry,
    keySchema,
    valueSchema
  });

  const treeListSchema = t.array(t.ref(treeListEntryDto), {
    description: `Flat list of ${baseName} tree entries for dropdown/select`
  });

  const threadedTreeSchema = t.array(t.ref(threadedNodeDto), {
    description: `Threaded tree structure of ${baseName} nodes`
  });

  return {
    entity: entityDto,
    node: nodeDto,
    nodeResult: nodeResultDto,
    threadedNode: threadedNodeDto,
    treeListEntry: treeListEntryDto,
    treeListSchema,
    threadedTreeSchema
  };
}

function createEntityDtoClass(
  target: any,
  options: { name: string } & Record<string, any>
): DtoConstructor {
  const DtoClass = class {};
  Object.defineProperty(DtoClass, "name", { value: options.name, configurable: true });
  MetalDto(target, options)(DtoClass);
  return DtoClass as DtoConstructor;
}

function createTreeNodeDtoClass(
  entityDto: DtoConstructor,
  options: { name: string; includeTreeMetadata: boolean }
): DtoConstructor {
  const TreeNodeDto = class {};
  Object.defineProperty(TreeNodeDto, "name", { value: options.name, configurable: true });

  const fields: Record<string, FieldMeta> = {
    entity: { schema: t.ref(entityDto) },
    lft: { schema: t.integer(), description: "Left boundary value (nested set)" },
    rght: { schema: t.integer(), description: "Right boundary value (nested set)" },
    isLeaf: { schema: t.boolean(), description: "Whether this node has no children" },
    isRoot: { schema: t.boolean(), description: "Whether this node has no parent" },
    childCount: { schema: t.integer({ minimum: 0 }), description: "Number of descendants" }
  };

  if (options.includeTreeMetadata) {
    fields.depth = {
      schema: t.integer({ minimum: 0 }),
      optional: true,
      description: "Depth level (0 = root)"
    };
  }

  registerDto(TreeNodeDto, {
    name: options.name,
    description: "A tree node with nested set boundaries and metadata",
    fields
  });

  return TreeNodeDto as DtoConstructor;
}

function createTreeNodeResultDtoClass(
  entityDto: DtoConstructor,
  options: {
    name: string;
    includeTreeMetadata: boolean;
    parentSchema: SchemaNode;
  }
): DtoConstructor {
  const TreeNodeResultDto = class {};
  Object.defineProperty(TreeNodeResultDto, "name", { value: options.name, configurable: true });

  const fields: Record<string, FieldMeta> = {
    data: { schema: t.ref(entityDto) },
    lft: { schema: t.integer(), description: "Left boundary value (nested set)" },
    rght: { schema: t.integer(), description: "Right boundary value (nested set)" },
    parentId: { schema: options.parentSchema, description: "Parent identifier (null for roots)" },
    isLeaf: { schema: t.boolean(), description: "Whether this node has no children" },
    isRoot: { schema: t.boolean(), description: "Whether this node has no parent" }
  };

  if (options.includeTreeMetadata) {
    fields.depth = {
      schema: t.integer({ minimum: 0 }),
      optional: true,
      description: "Depth level (0 = root)"
    };
  }

  registerDto(TreeNodeResultDto, {
    name: options.name,
    description: "A tree node result with nested set boundaries and metadata",
    fields
  });

  return TreeNodeResultDto as DtoConstructor;
}

function createThreadedNodeDtoClass(
  entityDto: DtoConstructor,
  options: { name: string }
): DtoConstructor {
  const ThreadedNodeDto = class {};
  Object.defineProperty(ThreadedNodeDto, "name", { value: options.name, configurable: true });

  registerDto(ThreadedNodeDto, {
    name: options.name,
    description: "A node in a threaded tree structure with nested children",
    fields: {
      node: { schema: t.ref(entityDto) },
      children: {
        schema: t.array(t.ref(ThreadedNodeDto as DtoConstructor)),
        description: "Child nodes in the tree hierarchy"
      }
    }
  });

  return ThreadedNodeDto as DtoConstructor;
}

function createTreeListEntryDtoClass(
  options: { name: string; keySchema: SchemaNode; valueSchema: SchemaNode }
): DtoConstructor {
  const TreeListEntryDto = class {};
  Object.defineProperty(TreeListEntryDto, "name", { value: options.name, configurable: true });

  registerDto(TreeListEntryDto, {
    name: options.name,
    description: "A tree list entry for dropdown/select rendering",
    fields: {
      key: { schema: options.keySchema, description: "The key (usually primary key)" },
      value: { schema: options.valueSchema, description: "The display value with depth prefix" },
      depth: { schema: t.integer({ minimum: 0 }), description: "The depth level" }
    }
  });

  return TreeListEntryDto as DtoConstructor;
}

function resolveParentKey(target: any, parentKey?: string): string {
  if (parentKey) {
    return parentKey;
  }
  if (typeof target === "function") {
    const config = getTreeConfig(target);
    if (config?.parentKey) {
      return config.parentKey;
    }
  }
  return "parentId";
}

function resolveParentSchema(
  target: any,
  parentKey: string,
  overrides?: Record<string, FieldOverride>,
  strict?: boolean
): SchemaNode {
  const fields = buildFields(target, {
    include: [parentKey],
    overrides,
    strict
  });
  return fields[parentKey]?.schema ?? t.nullable(t.string());
}

function resolvePrimaryKeySchema(
  target: any,
  overrides?: Record<string, FieldOverride>,
  strict?: boolean
): SchemaNode | undefined {
  const columns = getColumnMap(target);
  const primaryKey = Object.keys(columns).find((key) => columns[key]?.primary);
  if (!primaryKey) {
    return undefined;
  }
  const fields = buildFields(target, {
    include: [primaryKey],
    overrides,
    strict
  });
  return fields[primaryKey]?.schema;
}

function resolveNames(
  baseName: string,
  names?: MetalTreeDtoClassNames
): Required<MetalTreeDtoClassNames> {
  return {
    entity: names?.entity ?? `${baseName}Dto`,
    node: names?.node ?? `${baseName}NodeDto`,
    nodeResult: names?.nodeResult ?? `${baseName}NodeResultDto`,
    threadedNode: names?.threadedNode ?? `${baseName}ThreadedNodeDto`,
    treeListEntry: names?.treeListEntry ?? `${baseName}TreeListEntryDto`
  };
}

function getTargetName(target: any): string {
  if (typeof target === "function" && target.name) {
    return target.name;
  }
  return "Entity";
}
