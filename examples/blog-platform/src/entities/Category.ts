import { Entity, Column, PrimaryKey } from "metal-orm";

@Entity()
export class Category {
  @PrimaryKey({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar", notNull: true, unique: true })
  name!: string;

  @Column({ type: "varchar", notNull: true, unique: true })
  slug!: string;

  @Column({ type: "text", notNull: false })
  description?: string;
}
