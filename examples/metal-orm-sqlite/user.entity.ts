import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "users" })
export class User {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.text())
  email?: string | null;

  @Column(col.notNull(col.text()))
  createdAt!: string;
}
