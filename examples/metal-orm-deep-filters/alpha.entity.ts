import { Column, Entity, HasMany, PrimaryKey, col } from "metal-orm";
import type { HasManyCollection } from "metal-orm";
import { Bravo } from "./bravo.entity";

@Entity({ tableName: "alphas" })
export class Alpha {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  name!: string;

  @HasMany({ target: () => Bravo, foreignKey: "alphaId" })
  bravos!: HasManyCollection<Bravo>;
}
