import { Entity, Column, PrimaryKey } from "metal-orm";

@Entity()
export class Post {
  @PrimaryKey({ type: "uuid" })
  id!: string;

  @Column({ type: "uuid", notNull: true })
  authorId!: string;

  @Column({ type: "uuid", nullable: true })
  categoryId?: string;

  @Column({ type: "varchar", args: [255], notNull: true })
  title!: string;

  @Column({ type: "text", notNull: true })
  content!: string;

  @Column({ type: "varchar", args: [20], notNull: true, default: "draft" })
  status!: string;

  @Column({ type: "timestamp", nullable: true })
  publishedAt?: string;

  @Column({ type: "timestamp", notNull: true })
  createdAt!: string;
}
