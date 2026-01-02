import { Entity, Column, PrimaryKey, BelongsTo } from "metal-orm";
import { BlogPost } from "./BlogPost.js";
import { Tag } from "./Tag.js";

@Entity()
export class PostTag {
  @PrimaryKey({ type: "int", autoIncrement: true })
  id!: number;

  @Column({ type: "int", notNull: true })
  postId!: number;

  @Column({ type: "int", notNull: true })
  tagId!: number;

  @BelongsTo({ target: () => BlogPost, foreignKey: "postId" })
  post!: import("metal-orm").BelongsToReference<BlogPost>;

  @BelongsTo({ target: () => Tag, foreignKey: "tagId" })
  tag!: import("metal-orm").BelongsToReference<Tag>;
}
