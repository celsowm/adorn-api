const metal = require('metal-orm');

console.log('Available Metal-ORM functions:');
console.log('- createDtoToOpenApiSchema:', typeof metal.createDtoToOpenApiSchema);
console.log('- dtoToOpenApiSchema:', typeof metal.dtoToOpenApiSchema);
console.log('- getTableDefFromEntity:', typeof metal.getTableDefFromEntity);
console.log('- bootstrapEntities:', typeof metal.bootstrapEntities);
console.log('- createDtoToOpenApiSchema length:', metal.createDtoToOpenApiSchema.length);
console.log('- dtoToOpenApiSchema length:', metal.dtoToOpenApiSchema.length);
console.log('- getTableDefFromEntity length:', metal.getTableDefFromEntity.length);
