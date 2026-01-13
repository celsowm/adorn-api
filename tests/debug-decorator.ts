import { Controller, Get } from './src/index.js';

console.log('Before controller definition');

@Controller('/debug')
class DebugController {
  console.log('Inside class definition');
  
  @Get('/test')
  testMethod() {
    console.log('Method called');
    return { works: true };
  }
}

console.log('After controller definition');

const storage = globalThis.__adorn_metadata__;
console.log('Metadata storage:', storage);
