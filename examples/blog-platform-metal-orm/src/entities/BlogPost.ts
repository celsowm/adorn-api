import { Entity, Column, PrimaryKey, BelongsTo, HasMany, BelongsToMany } from "metal-orm";
import type { BelongsToReference, HasManyCollection, ManyToManyCollection } from "metal-orm";
import { User } from "./User.js";
import { Category } from "./Category.js";
import { Comment } from "./Comment.js";
import { Tag } from "./Tag.js";
import { PostTag } from "./PostTag.js";

@Entity()
export class BlogPost {
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

  @Column({ type: "timestamp", tsType: Date })
  publishedAt?: Date;

  @Column({ type: "timestamp", notNull: true, tsType: Date })
  createdAt!: Date;

  @BelongsTo({ target: () => User, foreignKey: "authorId" })
  author!: BelongsToReference<User>;

  @BelongsTo({ target: () => Category, foreignKey: "categoryId" })
  category!: BelongsToReference<Category>;

  @HasMany({ target: () => Comment, foreignKey: "postId" })
  comments!: HasManyCollection<Comment>;

  @BelongsToMany({
    target: () => Tag,
    pivotTable: () => PostTag,
    pivotForeignKeyToRoot: "postId",
    pivotForeignKeyToTarget: "tagId",
  })
  tags!: ManyToManyCollection<Tag, PostTag>;
}
