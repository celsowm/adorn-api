import { Entity, Column, PrimaryKey, BelongsTo } from "metal-orm";
import type { BelongsToReference } from "metal-orm";
import { BlogPost } from "./BlogPost.js";
import { User } from "./User.js";

@Entity()
export class Comment {
  @PrimaryKey({ type: "int", autoIncrement: true })
  id!: number;

  @Column({ type: "int", notNull: true })
  postId!: number;

  @Column({ type: "int", notNull: true })
  authorId!: number;

  @Column({ type: "text", notNull: true })
  content!: string;

  @Column({ type: "timestamp", notNull: true, tsType: Date })
  createdAt!: Date;

  @BelongsTo({ target: () => BlogPost, foreignKey: "postId" })
  post!: BelongsToReference<BlogPost>;

  @BelongsTo({ target: () => User, foreignKey: "authorId" })
  author!: BelongsToReference<User>;
}
