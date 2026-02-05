import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "deltas" })
export class Delta {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  name!: string;
}
