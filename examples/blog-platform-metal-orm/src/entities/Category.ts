import { Entity, Column, PrimaryKey, HasMany } from "metal-orm";
import { Post } from "./Post.js";

@Entity({ tableName: "categories" })
export class Category {
  @PrimaryKey({ type: "int", autoIncrement: true })
  id!: number;

  @Column({ type: "varchar", args: [255], notNull: true, unique: true })
  name!: string;

  @Column({ type: "varchar", args: [255], notNull: true, unique: true })
  slug!: string;

  @Column({ type: "text" })
  description?: string;

  @HasMany({ target: () => Post, foreignKey: "categoryId" })
  posts!: import("metal-orm").HasManyCollection<Post>;
}
