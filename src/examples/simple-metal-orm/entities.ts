import { Column, Entity, PrimaryKey, col } from 'metal-orm';

export const userStatusValues = ['active', 'locked'] as const;
export type UserStatus = (typeof userStatusValues)[number];

@Entity({ tableName: 'usuarios' })
export class User {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  nome!: string;

  @Column(col.notNull(col.varchar(255)))
  email!: string;

  @Column(col.notNull(col.varchar(20)))
  status!: UserStatus;

  @Column(col.notNull(col.varchar(30)))
  createdAt!: string;
}
