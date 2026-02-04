import { Column, Entity, PrimaryKey, Tree, TreeChildren, TreeParent, col } from "metal-orm";

@Entity({ tableName: "categories" })
@Tree({ parentKey: "parentId", leftKey: "lft", rightKey: "rght", depthKey: "depth" })
export class Category {
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
  parent?: Category;

  @TreeChildren()
  children?: Category[];
}
