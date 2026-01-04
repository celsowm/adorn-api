import { Entity, Column, PrimaryKey, BelongsTo } from "metal-orm";
import type { BelongsToReference } from "metal-orm";
import { User } from "./User.js";

@Entity()
export class Post {
    @PrimaryKey({ type: "int", autoIncrement: true })
    id!: number;

    @Column({ type: "int", notNull: true })
    authorId!: number;

    @Column({ type: "varchar", args: [255], notNull: true })
    title!: string;

    @Column({ type: "text", notNull: true })
    content!: string;

    @Column({ type: "varchar", args: [20], notNull: true, default: "draft" })
    status!: string;

    @BelongsTo({ target: () => User, foreignKey: "authorId" })
    author!: BelongsToReference<User>;
}
