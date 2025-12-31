import sqlite3 from "sqlite3";

let db: sqlite3.Database;

export async function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(":memory:", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function createTables(): Promise<void> {
  await runQuery(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    bio TEXT,
    created_at TEXT NOT NULL
  )`);

  await runQuery(`CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT
  )`);

  await runQuery(`CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280'
  )`);

  await runQuery(`CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    category_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  await runQuery(`CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  await runQuery(`CREATE TABLE post_tags (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id)
  )`);
}

export async function seedData(): Promise<void> {
  await runQuery(`INSERT INTO users (id, email, name, bio, created_at) VALUES ('usr_001', 'alice@example.com', 'Alice Johnson', 'Tech writer', datetime('now'))`);
  await runQuery(`INSERT INTO users (id, email, name, bio, created_at) VALUES ('usr_002', 'bob@example.com', 'Bob Smith', 'Full-stack developer', datetime('now'))`);
  await runQuery(`INSERT INTO categories (id, name, slug, description) VALUES ('cat_001', 'Technology', 'technology', 'Tech articles')`);
  await runQuery(`INSERT INTO categories (id, name, slug, description) VALUES ('cat_002', 'Lifestyle', 'lifestyle', 'Lifestyle content')`);
  await runQuery(`INSERT INTO tags (id, name, color) VALUES ('tag_001', 'typescript', '#3178C6')`);
  await runQuery(`INSERT INTO tags (id, name, color) VALUES ('tag_002', 'javascript', '#F7DF1E')`);
  await runQuery(`INSERT INTO posts (id, author_id, category_id, title, content, status, created_at) VALUES ('post_001', 'usr_001', 'cat_001', 'Getting Started with Metal-ORM', 'Metal-orm is powerful...', 'published', datetime('now'))`);
  await runQuery(`INSERT INTO posts (id, author_id, category_id, title, content, status, created_at) VALUES ('post_002', 'usr_001', 'cat_001', 'Building APIs', 'Learn how to build APIs...', 'draft', datetime('now'))`);
  await runQuery(`INSERT INTO comments (id, post_id, author_id, content, created_at) VALUES ('cmt_001', 'post_001', 'usr_002', 'Great article!', datetime('now'))`);
}

function runQuery(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function all<T>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

function get<T>(sql: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export interface User {
  id: string;
  email: string;
  name: string;
  bio?: string;
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  categoryId?: string;
  title: string;
  content: string;
  status: string;
  publishedAt?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export const UserRepo = {
  findAll: () => all<User>("SELECT * FROM users"),
  findById: (id: string) => get<User>(`SELECT * FROM users WHERE id = '${id}'`),
  create: async (data: Omit<User, "id" | "createdAt">): Promise<User> => {
    const id = `usr_${Date.now()}`;
    const createdAt = new Date().toISOString();
    await runQuery(`INSERT INTO users (id, email, name, bio, created_at) VALUES ('${id}', '${data.email}', '${data.name}', '${data.bio || ''}', '${createdAt}')`);
    return { ...data, id, createdAt };
  },
  update: async (id: string, data: Partial<Omit<User, "id" | "email" | "createdAt">>): Promise<User | null> => {
    const sets: string[] = [];
    if (data.name !== undefined) sets.push(`name = '${data.name}'`);
    if (data.bio !== undefined) sets.push(`bio = '${data.bio}'`);
    if (sets.length > 0) {
      await runQuery(`UPDATE users SET ${sets.join(", ")} WHERE id = '${id}'`);
    }
    return UserRepo.findById(id);
  },
  delete: async (id: string): Promise<void> => {
    await runQuery(`DELETE FROM users WHERE id = '${id}'`);
  },
};

export const PostRepo = {
  findAll: (filters?: { authorId?: string; status?: string }): Promise<Post[]> => {
    let sql = "SELECT * FROM posts WHERE 1=1";
    if (filters?.authorId) sql += ` AND author_id = '${filters.authorId}'`;
    if (filters?.status) sql += ` AND status = '${filters.status}'`;
    return all<Post>(sql);
  },
  findById: (id: string) => get<Post>(`SELECT * FROM posts WHERE id = '${id}'`),
  create: async (data: Omit<Post, "id" | "createdAt">): Promise<Post> => {
    const id = `post_${Date.now()}`;
    const createdAt = new Date().toISOString();
    await runQuery(`INSERT INTO posts (id, author_id, category_id, title, content, status, created_at) VALUES ('${id}', '${data.authorId}', '${data.categoryId || ''}', '${data.title.replace(/'/g, "''")}', '${data.content.replace(/'/g, "''")}', '${data.status}', '${createdAt}')`);
    return { ...data, id, createdAt };
  },
  update: async (id: string, data: Partial<Omit<Post, "id" | "authorId" | "createdAt">>): Promise<Post | null> => {
    const sets: string[] = [];
    if (data.title !== undefined) sets.push(`title = '${data.title.replace(/'/g, "''")}'`);
    if (data.content !== undefined) sets.push(`content = '${data.content.replace(/'/g, "''")}'`);
    if (data.status !== undefined) sets.push(`status = '${data.status}'`);
    if (data.categoryId !== undefined) sets.push(`category_id = '${data.categoryId}'`);
    if (data.publishedAt !== undefined) sets.push(`published_at = '${data.publishedAt}'`);
    if (sets.length > 0) {
      await runQuery(`UPDATE posts SET ${sets.join(", ")} WHERE id = '${id}'`);
    }
    return PostRepo.findById(id);
  },
  delete: async (id: string): Promise<void> => {
    await runQuery(`DELETE FROM posts WHERE id = '${id}'`);
  },
};

export const CommentRepo = {
  findByPostId: (postId: string) => all<Comment>(`SELECT * FROM comments WHERE post_id = '${postId}'`),
  findAll: () => all<Comment>("SELECT * FROM comments"),
  findById: (id: string) => get<Comment>(`SELECT * FROM comments WHERE id = '${id}'`),
  create: async (data: Omit<Comment, "id" | "createdAt">): Promise<Comment> => {
    const id = `cmt_${Date.now()}`;
    const createdAt = new Date().toISOString();
    await runQuery(`INSERT INTO comments (id, post_id, author_id, content, created_at) VALUES ('${id}', '${data.postId}', '${data.authorId}', '${data.content.replace(/'/g, "''")}', '${createdAt}')`);
    return { ...data, id, createdAt };
  },
  delete: async (id: string): Promise<void> => {
    await runQuery(`DELETE FROM comments WHERE id = '${id}'`);
  },
};

export const CategoryRepo = {
  findAll: () => all<Category>("SELECT * FROM categories"),
  findById: (id: string) => get<Category>(`SELECT * FROM categories WHERE id = '${id}'`),
  create: async (data: Omit<Category, "id">): Promise<Category> => {
    const id = `cat_${Date.now()}`;
    await runQuery(`INSERT INTO categories (id, name, slug, description) VALUES ('${id}', '${data.name}', '${data.slug}', '${data.description || ''}')`);
    return { ...data, id };
  },
  delete: async (id: string): Promise<void> => {
    await runQuery(`DELETE FROM categories WHERE id = '${id}'`);
  },
};

export const TagRepo = {
  findAll: () => all<Tag>("SELECT * FROM tags"),
  findById: (id: string) => get<Tag>(`SELECT * FROM tags WHERE id = '${id}'`),
  create: async (data: Omit<Tag, "id">): Promise<Tag> => {
    const id = `tag_${Date.now()}`;
    await runQuery(`INSERT INTO tags (id, name, color) VALUES ('${id}', '${data.name}', '${data.color}')`);
    return { ...data, id };
  },
  delete: async (id: string): Promise<void> => {
    await runQuery(`DELETE FROM tags WHERE id = '${id}'`);
  },
};
