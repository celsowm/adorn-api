import { Entity, Column, PrimaryKey } from "metal-orm";

@Entity()
export class Tag {
  @PrimaryKey({ type: "varchar" })
  id!: string;

  @Column({ type: "varchar", notNull: true, unique: true })
  name!: string;

  @Column({ type: "varchar", notNull: true })
  color!: string;
}
