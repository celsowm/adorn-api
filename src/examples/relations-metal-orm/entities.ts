import {
  BelongsTo,
  Column,
  Entity,
  HasMany,
  PrimaryKey,
  col,
  type BelongsToReference,
  type HasManyCollection
} from 'metal-orm';

@Entity({ tableName: 'authors' })
export class Author {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @Column(col.notNull(col.varchar(30)))
  createdAt!: string;

  @HasMany({ target: () => Post, foreignKey: 'authorId' })
  posts!: HasManyCollection<Post>;
}

@Entity({ tableName: 'posts' })
export class Post {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  authorId!: number;

  @Column(col.notNull(col.varchar(255)))
  title!: string;

  @Column(col.varchar(2000))
  body?: string;

  @Column(col.notNull(col.varchar(30)))
  createdAt!: string;

  @BelongsTo({ target: () => Author, foreignKey: 'authorId' })
  author?: BelongsToReference<Author>;
}
