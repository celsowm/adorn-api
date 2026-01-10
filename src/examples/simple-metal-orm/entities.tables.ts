import { bootstrapEntities, getTableDefFromEntity } from 'metal-orm';

import { User } from './entities.js';

export const bootstrapEntityTables = () => {
  bootstrapEntities();
  return {
    User: getTableDefFromEntity(User)!
  };
};

export const allTables = () => bootstrapEntities();
