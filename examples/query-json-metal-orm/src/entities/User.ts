import { Entity, Column, PrimaryKey, HasMany } from "metal-orm";
import type { HasManyCollection } from "metal-orm";
import { Post } from "./Post.js";

@Entity()
export class User {
    @PrimaryKey({ type: "int", autoIncrement: true })
    id!: number;

    @Column({ type: "varchar", args: [255], notNull: true })
    name!: string;

    @Column({ type: "varchar", args: [255], notNull: true, unique: true })
    email!: string;

    @HasMany({ target: () => Post, foreignKey: "authorId" })
    posts!: HasManyCollection<Post>;
}
