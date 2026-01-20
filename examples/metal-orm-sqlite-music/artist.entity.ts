import { Column, Entity, HasMany, PrimaryKey, col } from "metal-orm";
import type { HasManyCollection } from "metal-orm";
import { Album } from "./album.entity";

@Entity({ tableName: "artists" })
export class Artist {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  name!: string;

  @Column(col.text())
  genre?: string | null;

  @Column(col.text())
  country?: string | null;

  @Column(col.int())
  formedYear?: number | null;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @HasMany({ target: () => Album, foreignKey: "artistId" })
  albums!: HasManyCollection<Album>;
}
