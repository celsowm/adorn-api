import { Entity, Column, PrimaryKey, HasMany } from "metal-orm";
import { Post } from "./Post.js";
import { Comment } from "./Comment.js";

@Entity()
export class User {
  @PrimaryKey({ type: "int", autoIncrement: true })
  id!: number;

  @Column({ type: "varchar", args: [255], notNull: true, unique: true })
  email!: string;

  @Column({ type: "varchar", args: [255], notNull: true })
  name!: string;

  @Column({ type: "text" })
  bio?: string;

  @Column({ type: "timestamp", notNull: true })
  createdAt!: string;

  @HasMany({ target: () => Post, foreignKey: "authorId" })
  posts!: import("metal-orm").HasManyCollection<Post>;

  @HasMany({ target: () => Comment, foreignKey: "authorId" })
  comments!: import("metal-orm").HasManyCollection<Comment>;
}
