const metal = require('metal-orm');

// Test createDtoToOpenApiSchema
console.log('=== Testing createDtoToOpenApiSchema ===');
const User = class User {
  constructor() {
    this.id = 0;
    this.name = '';
    this.email = '';
    this.role = '';
    this.createdAt = new Date();
  }
};

const createSchema = metal.createDtoToOpenApiSchema(User);
console.log('createSchema:', JSON.stringify(createSchema, null, 2));

console.log('\n=== Testing dtoToOpenApiSchema ===');
const tableDef = metal.getTableDefFromEntity(User);
console.log('tableDef:', tableDef);

if (tableDef) {
  const schema = metal.dtoToOpenApiSchema(tableDef);
  console.log('schema:', JSON.stringify(schema, null, 2));
}
