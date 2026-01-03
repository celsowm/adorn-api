import { Entity, Column, PrimaryKey, BelongsToMany } from "metal-orm";
import { BlogPost } from "./BlogPost.js";
import { PostTag } from "./PostTag.js";

@Entity()
export class Tag {
  @PrimaryKey({ type: "int", autoIncrement: true })
  id!: number;

  @Column({ type: "varchar", args: [255], notNull: true, unique: true })
  name!: string;

  @Column({ type: "varchar", args: [20], notNull: true, default: "#6B7280" })
  color!: string;

  @BelongsToMany({
    target: () => BlogPost,
    pivotTable: () => PostTag,
    pivotForeignKeyToRoot: "tagId",
    pivotForeignKeyToTarget: "postId",
  })
  posts!: import("metal-orm").ManyToManyCollection<BlogPost, PostTag>;
}
