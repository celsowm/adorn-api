import { entityRef } from 'metal-orm';

import { User } from './entities.js';
import { bootstrapEntityTables } from './entities.tables.js';

const tables = bootstrapEntityTables();

export const usersTable = tables.User;
export const userRef = entityRef(User);
