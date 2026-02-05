import { BelongsTo, Column, Entity, PrimaryKey, col } from "metal-orm";
import type { BelongsToReference } from "metal-orm";
import { Bravo } from "./bravo.entity";
import { Delta } from "./delta.entity";

@Entity({ tableName: "charlies" })
export class Charlie {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  score!: number;

  @Column(col.notNull(col.int()))
  bravoId!: number;

  @Column(col.int())
  deltaId?: number | null;

  @BelongsTo({ target: () => Bravo, foreignKey: "bravoId" })
  bravo!: BelongsToReference<Bravo>;

  @BelongsTo({ target: () => Delta, foreignKey: "deltaId" })
  delta?: BelongsToReference<Delta>;
}
