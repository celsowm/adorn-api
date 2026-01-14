const metal = require('metal-orm');

// Mock entity class
class User {
  constructor() {
    this.id = 0;
    this.name = '';
    this.email = '';
    this.role = '';
    this.createdAt = new Date();
  }
}

// Test getTableDefFromEntity
console.log('=== Testing getTableDefFromEntity ===');
const tableDef = metal.getTableDefFromEntity(User);
console.log('tableDef:', JSON.stringify(tableDef, null, 2));

// Test dtoToOpenApiSchema
console.log('\n=== Testing dtoToOpenApiSchema ===');
const schema = metal.dtoToOpenApiSchema(tableDef);
console.log('schema:', JSON.stringify(schema, null, 2));
