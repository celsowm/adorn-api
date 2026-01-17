import { BelongsTo, Column, Entity, PrimaryKey, col } from "metal-orm";
import type { BelongsToReference } from "metal-orm";
import { Album } from "./album.entity";

@Entity({ tableName: "tracks" })
export class Track {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  title!: string;

  @Column(col.int())
  durationSeconds?: number | null;

  @Column(col.int())
  trackNumber?: number | null;

  @Column(col.notNull(col.int()))
  albumId!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @BelongsTo({ target: () => Album, foreignKey: "albumId" })
  album!: BelongsToReference<Album>;
}
