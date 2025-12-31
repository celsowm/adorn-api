import { Entity, Column, PrimaryKey } from "metal-orm";

@Entity()
export class Comment {
  @PrimaryKey({ type: "uuid" })
  id!: string;

  @Column({ type: "uuid", notNull: true })
  postId!: string;

  @Column({ type: "uuid", notNull: true })
  authorId!: string;

  @Column({ type: "text", notNull: true })
  content!: string;

  @Column({ type: "timestamp", notNull: true })
  createdAt!: string;
}
