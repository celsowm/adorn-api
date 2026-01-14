import "reflect-metadata";
import {
  Entity,
  Column,
  PrimaryKey,
  col,
  bootstrapEntities,
  getTableDefFromEntity,
} from "metal-orm";

@Entity()
class TestUser {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;
}

console.log("Before bootstrap");
bootstrapEntities();
console.log("After bootstrap");

const result = getTableDefFromEntity(TestUser);
console.log("Result type:", typeof result);
console.log("Result:", JSON.stringify(result, null, 2));

process.exit(0);
