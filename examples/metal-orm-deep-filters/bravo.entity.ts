import { BelongsTo, Column, Entity, HasMany, PrimaryKey, col } from "metal-orm";
import type { BelongsToReference, HasManyCollection } from "metal-orm";
import { Alpha } from "./alpha.entity";
import { Charlie } from "./charlie.entity";

@Entity({ tableName: "bravos" })
export class Bravo {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  code!: string;

  @Column(col.notNull(col.int()))
  alphaId!: number;

  @BelongsTo({ target: () => Alpha, foreignKey: "alphaId" })
  alpha!: BelongsToReference<Alpha>;

  @HasMany({ target: () => Charlie, foreignKey: "bravoId" })
  charlies!: HasManyCollection<Charlie>;
}
