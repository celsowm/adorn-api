import { Column, Entity, HasMany, PrimaryKey, col } from "metal-orm";
import type { HasManyCollection } from "metal-orm";
import { Post } from "./post.entity";

@Entity({ tableName: "users" })
export class User {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.text())
  email?: string | null;

  @Column(col.notNull(col.datetime<Date>()))
  createdAt!: Date;

  @HasMany({ target: () => Post, foreignKey: "userId" })
  posts!: HasManyCollection<Post>;
}
