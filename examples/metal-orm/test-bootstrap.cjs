const metal = require('metal-orm');
const { Entity, Column, PrimaryKey, col } = require('metal-orm');

// Define a test entity
@Entity()
class TestEntity {
  @PrimaryKey(col.int())
  id = 0;

  @Column(col.varchar(255))
  name = '';

  @Column(col.varchar(255))
  email = '';
}

console.log('Before bootstrapEntities:');
console.log('getTableDefFromEntity:', metal.getTableDefFromEntity(TestEntity));

// Bootstrap entities
metal.bootstrapEntities();

console.log('\nAfter bootstrapEntities:');
const tableDef = metal.getTableDefFromEntity(TestEntity);
console.log('getTableDefFromEntity:', tableDef);

if (tableDef) {
  console.log('\ndtoToOpenApiSchema:');
  const schema = metal.dtoToOpenApiSchema(tableDef);
  console.log(JSON.stringify(schema, null, 2));
}

console.log('\ncreateDtoToOpenApiSchema:');
const createSchema = metal.createDtoToOpenApiSchema(TestEntity);
console.log(JSON.stringify(createSchema, null, 2));

console.log('\nupdateDtoToOpenApiSchema:');
const updateSchema = metal.updateDtoToOpenApiSchema(TestEntity);
console.log(JSON.stringify(updateSchema, null, 2));
