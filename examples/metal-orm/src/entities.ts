import { Entity, Column, PrimaryKey, col } from "metal-orm";

@Entity()
export class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @Column(col.varchar(255))
  email!: string;

  @Column(col.varchar(50))
  role!: string;

  @Column(col.timestamp())
  createdAt!: Date;
}

@Entity()
export class Post {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  title!: string;

  @Column(col.text())
  content!: string;

  @Column(col.boolean())
  published!: boolean;

  @Column(col.int())
  authorId!: number;

  @Column(col.timestamp())
  createdAt!: Date;
}
