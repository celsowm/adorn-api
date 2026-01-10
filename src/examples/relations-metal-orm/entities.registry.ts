import { entityRef } from 'metal-orm';

import { Author, Post } from './entities.js';
import { bootstrapEntityTables } from './entities.tables.js';

const tables = bootstrapEntityTables();

export const authorTable = tables.Author;
export const postTable = tables.Post;

export const authorRef = entityRef(Author);
export const postRef = entityRef(Post);
