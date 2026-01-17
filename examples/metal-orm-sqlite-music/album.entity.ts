import { BelongsTo, Column, Entity, HasMany, PrimaryKey, col } from "metal-orm";
import type { BelongsToReference, HasManyCollection } from "metal-orm";
import { Artist } from "./artist.entity";
import { Track } from "./track.entity";

@Entity({ tableName: "albums" })
export class Album {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.text()))
  title!: string;

  @Column(col.int())
  releaseYear?: number | null;

  @Column(col.notNull(col.int()))
  artistId!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @BelongsTo({ target: () => Artist, foreignKey: "artistId" })
  artist!: BelongsToReference<Artist>;

  @HasMany({ target: () => Track, foreignKey: "albumId" })
  tracks!: HasManyCollection<Track>;
}
