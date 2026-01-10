import { bootstrapEntities, getTableDefFromEntity } from 'metal-orm';

import { Author, Post } from './entities.js';

export const bootstrapEntityTables = () => {
  bootstrapEntities();
  return {
    Author: getTableDefFromEntity(Author)!,
    Post: getTableDefFromEntity(Post)!
  };
};

export const allTables = () => bootstrapEntities();
