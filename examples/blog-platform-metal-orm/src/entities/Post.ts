import { Entity, Column, PrimaryKey, BelongsTo, HasMany, BelongsToMany } from "metal-orm";
import { User } from "./User.js";
import { Category } from "./Category.js";
import { Comment } from "./Comment.js";
import { Tag } from "./Tag.js";
import { PostTag } from "./PostTag.js";

@Entity()
export class Post {
  @PrimaryKey({ type: "int", autoIncrement: true })
  id!: number;

  @Column({ type: "int", notNull: true })
  authorId!: number;

  @Column({ type: "int" })
  categoryId?: number;

  @Column({ type: "varchar", args: [255], notNull: true })
  title!: string;

  @Column({ type: "text", notNull: true })
  content!: string;

  @Column({ type: "varchar", args: [20], notNull: true, default: "draft" })
  status!: string;

  @Column({ type: "timestamp" })
  publishedAt?: string;

  @Column({ type: "timestamp", notNull: true })
  createdAt!: string;

  @BelongsTo({ target: () => User, foreignKey: "authorId" })
  author!: import("metal-orm").BelongsToReference<User>;

  @BelongsTo({ target: () => Category, foreignKey: "categoryId" })
  category!: import("metal-orm").BelongsToReference<Category>;

  @HasMany({ target: () => Comment, foreignKey: "postId" })
  comments!: import("metal-orm").HasManyCollection<Comment>;

  @BelongsToMany({ target: () => Tag, pivotTable: () => PostTag })
  tags!: import("metal-orm").ManyToManyCollection<Tag, PostTag>;
}
