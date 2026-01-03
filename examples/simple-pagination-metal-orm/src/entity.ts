import {
  Entity,
  PrimaryKey,
  Column,
} from "metal-orm";

@Entity()
export class Task {
  @PrimaryKey({ type: "int", autoIncrement: true })
  id!: number;

  @Column({ type: "varchar", args: [255], notNull: true })
  title!: string;

  @Column({ type: "boolean", notNull: true, default: false })
  completed!: boolean;

  @Column({ type: "timestamp", notNull: true, tsType: Date })
  createdAt!: Date;
}
