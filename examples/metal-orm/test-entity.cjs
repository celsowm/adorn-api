const metal = require('metal-orm');

console.log('Available functions:');
console.log('- createDtoToOpenApiSchema:', typeof metal.createDtoToOpenApiSchema);
console.log('- updateDtoToOpenApiSchema:', typeof metal.updateDtoToOpenApiSchema);
console.log('- getTableDefFromEntity:', typeof metal.getTableDefFromEntity);
console.log('- dtoToOpenApiSchema:', typeof metal.dtoToOpenApiSchema);

// Test with a mock class
class MockEntity {
  constructor() {
    this.id = 0;
    this.name = '';
  }
}

console.log('\nCalling createDtoToOpenApiSchema with mock:');
try {
  const result = metal.createDtoToOpenApiSchema(MockEntity);
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\nCalling updateDtoToOpenApiSchema with mock:');
try {
  const result = metal.updateDtoToOpenApiSchema(MockEntity);
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (e) {
  console.log('Error:', e.message);
}
