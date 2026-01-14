const metal = require('metal-orm');

// Import the real entities
// Since entities.js is an ESM module, we need to use dynamic import
(async () => {
  const entitiesModule = await import('./src/entities.js');
  const { User, Post } = entitiesModule;
  
  console.log('=== Before bootstrapEntities ===');
  console.log('User constructor:', User.name);
  console.log('Post constructor:', Post.name);
  
  // Try to get table defs
  console.log('\nUser tableDef:', metal.getTableDefFromEntity(User));
  console.log('Post tableDef:', metal.getTableDefFromEntity(Post));
  
  // Bootstrap entities
  console.log('\n=== Calling bootstrapEntities ===');
  metal.bootstrapEntities();
  
  console.log('\n=== After bootstrapEntities ===');
  console.log('User tableDef:', metal.getTableDefFromEntity(User));
  console.log('Post tableDef:', metal.getTableDefFromEntity(Post));
  
  if (metal.getTableDefFromEntity(User)) {
    console.log('\nUser schema:', JSON.stringify(metal.dtoToOpenApiSchema(metal.getTableDefFromEntity(User)), null, 2));
  }
  
  console.log('\nUser create schema:', JSON.stringify(metal.createDtoToOpenApiSchema(User), null, 2));
  console.log('\nUser update schema:', JSON.stringify(metal.updateDtoToOpenApiSchema(User), null, 2));
})();
