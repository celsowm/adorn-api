import { Entity, Column, PrimaryKey, BelongsTo } from "metal-orm";
import { Post } from "./Post.js";
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

  @Column({ type: "timestamp", notNull: true })
  createdAt!: string;

  @BelongsTo({ target: () => Post, foreignKey: "postId" })
  post!: import("metal-orm").BelongsToReference<Post>;

  @BelongsTo({ target: () => User, foreignKey: "authorId" })
  author!: import("metal-orm").BelongsToReference<User>;
}
