import { Entity, Column, PrimaryKey } from "metal-orm";

@Entity()
export class User {
  @PrimaryKey({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar", notNull: true, unique: true })
  email!: string;

  @Column({ type: "varchar", notNull: true })
  name!: string;

  @Column({ type: "text", notNull: false })
  bio?: string;

  @Column({ type: "timestamp", notNull: true })
  createdAt!: string;
}
