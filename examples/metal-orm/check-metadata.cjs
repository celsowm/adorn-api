const metal = require('metal-orm');

// Try to check if there's metadata storage
console.log('Metal-ORM exports:', Object.keys(metal).filter(k => k.toLowerCase().includes('metadata') || k.toLowerCase().includes('storage')));

// Try to get metadata
console.log('\nChecking metadata storage...');
if (metal.metadataStorage) {
  console.log('metadataStorage exists:', typeof metal.metadataStorage);
}

// Check if there's a way to get all entities
console.log('\nChecking entity registry...');
if (metal.getEntities) {
  console.log('getEntities:', typeof metal.getEntities);
}

// Try reflect-metadata
const Reflect = require('reflect-metadata');
console.log('\nreflect-metadata available:', !!Reflect);

// Check if there's metadata on the constructor
class TestClass {}
const metadata = Reflect.getOwnMetadata('design:paramtypes', TestClass);
console.log('design:paramtypes:', metadata);

// Check all metadata keys
const allMetadata = Reflect.getMetadataKeys(TestClass);
console.log('All metadata keys:', allMetadata);
