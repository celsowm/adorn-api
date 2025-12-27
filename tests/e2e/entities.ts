import { BelongsTo, Column, Entity, HasMany, PrimaryKey, col } from 'metal-orm';
import type { BelongsToReference, HasManyCollection } from 'metal-orm';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column({ type: 'TEXT', notNull: true })
  name!: string;

  @Column({ type: 'TEXT', notNull: true })
  email!: string;

  @Column({ type: 'BOOLEAN', notNull: true })
  active!: boolean;

  @HasMany({ target: () => Post, foreignKey: 'user_id' })
  posts!: HasManyCollection<Post>;

  @HasMany({ target: () => Order, foreignKey: 'user_id' })
  orders!: HasManyCollection<Order>;
}

@Entity({ tableName: 'posts' })
export class Post {
  @PrimaryKey(col.int())
  id!: number;

  @Column({ type: 'INTEGER', notNull: true })
  user_id!: number;

  @Column({ type: 'TEXT', notNull: true })
  title!: string;

  @BelongsTo({ target: () => User, foreignKey: 'user_id' })
  user!: BelongsToReference<User>;
}

@Entity({ tableName: 'orders' })
export class Order {
  @PrimaryKey(col.int())
  id!: number;

  @Column({ type: 'INTEGER', notNull: true })
  user_id!: number;

  @Column({ type: 'FLOAT', notNull: true })
  total!: number;

  @Column({ type: 'TEXT', notNull: true })
  status!: string;

  @BelongsTo({ target: () => User, foreignKey: 'user_id' })
  user!: BelongsToReference<User>;
}
