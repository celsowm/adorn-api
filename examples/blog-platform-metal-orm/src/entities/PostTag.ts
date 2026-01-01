import { Entity, Column, PrimaryKey, BelongsTo } from "metal-orm";
import { Post } from "./Post.js";
import { Tag } from "./Tag.js";

@Entity()
export class PostTag {
  @PrimaryKey({ type: "int", autoIncrement: true })
  id!: number;

  @Column({ type: "int", notNull: true })
  postId!: number;

  @Column({ type: "int", notNull: true })
  tagId!: number;

  @BelongsTo({ target: () => Post, foreignKey: "postId" })
  post!: import("metal-orm").BelongsToReference<Post>;

  @BelongsTo({ target: () => Tag, foreignKey: "tagId" })
  tag!: import("metal-orm").BelongsToReference<Tag>;
}
