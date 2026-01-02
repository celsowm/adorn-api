import { Entity, Column, PrimaryKey, HasMany } from "metal-orm";
import { BlogPost } from "./BlogPost.js";
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

  @Column({ type: "timestamp", notNull: true, tsType: Date })
  createdAt!: Date;

  @HasMany({ target: () => BlogPost, foreignKey: "authorId" })
  posts!: import("metal-orm").HasManyCollection<BlogPost>;

  @HasMany({ target: () => Comment, foreignKey: "authorId" })
  comments!: import("metal-orm").HasManyCollection<Comment>;
}
