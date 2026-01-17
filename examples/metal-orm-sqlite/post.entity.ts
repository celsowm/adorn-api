import { BelongsTo, Column, Entity, PrimaryKey, col } from "metal-orm";
import type { BelongsToReference } from "metal-orm";
import { User } from "./user.entity";

@Entity({ tableName: "posts" })
export class Post {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  title!: string;

  @Column(col.text())
  body?: string | null;

  @Column(col.notNull(col.int()))
  userId!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @BelongsTo({ target: () => User, foreignKey: "userId" })
  user!: BelongsToReference<User>;
}
