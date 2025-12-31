import { Entity, Column, PrimaryKey } from "metal-orm";

@Entity()
export class PostTag {
  @PrimaryKey({ type: "varchar" })
  id!: string;

  @Column({ type: "uuid", notNull: true })
  postId!: string;

  @Column({ type: "uuid", notNull: true })
  tagId!: string;
}
