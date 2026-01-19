import sqlite3 from "sqlite3";
import {
  Orm,
  SqliteDialect,
  createSqliteExecutor,
  type SqliteClientLike
} from "metal-orm";

let db: sqlite3.Database | null = null;
let orm: Orm | null = null;

function execSql(database: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    database.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function createSqliteClient(database: sqlite3.Database): SqliteClientLike {
  return {
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows as Record<string, unknown>[]);
        });
      });
    },
    beginTransaction() {
      return execSql(database, "BEGIN");
    },
    commitTransaction() {
      return execSql(database, "COMMIT");
    },
    rollbackTransaction() {
      return execSql(database, "ROLLBACK");
    }
  };
}

export async function initializeDatabase() {
  db = new sqlite3.Database(":memory:");
  await execSql(db, "pragma foreign_keys = ON");
  await execSql(
    db,
    "create table artists (id integer primary key autoincrement, name text not null, genre text, country text, formedYear integer, createdAt text not null)"
  );
  await execSql(
    db,
    "create table albums (id integer primary key autoincrement, title text not null, releaseYear integer, artistId integer not null, createdAt text not null, foreign key(artistId) references artists(id))"
  );
  await execSql(
    db,
    "create table tracks (id integer primary key autoincrement, title text not null, durationSeconds integer, trackNumber integer, albumId integer not null, createdAt text not null, foreign key(albumId) references albums(id))"
  );

  await execSql(db, `
    INSERT INTO artists (name, genre, country, formedYear, createdAt) VALUES 
      ('The Beatles', 'Rock', 'United Kingdom', 1960, '2026-01-17T00:00:00.000Z'),
      ('Led Zeppelin', 'Rock', 'United Kingdom', 1968, '2026-01-17T00:00:00.000Z'),
      ('Pink Floyd', 'Progressive Rock', 'United Kingdom', 1965, '2026-01-17T00:00:00.000Z')
  `);

  await execSql(db, `
    INSERT INTO albums (title, releaseYear, artistId, createdAt) VALUES 
      ('Abbey Road', 1969, 1, '2026-01-17T00:00:00.000Z'),
      ('Led Zeppelin IV', 1971, 2, '2026-01-17T00:00:00.000Z'),
      ('The Dark Side of the Moon', 1973, 3, '2026-01-17T00:00:00.000Z'),
      ('Sgt. Pepper''s Lonely Hearts Club Band', 1967, 1, '2026-01-17T00:00:00.000Z')
  `);

  await execSql(db, `
    INSERT INTO tracks (title, durationSeconds, trackNumber, albumId, createdAt) VALUES 
      ('Come Together', 259, 1, 1, '2026-01-17T00:00:00.000Z'),
      ('Something', 182, 2, 1, '2026-01-17T00:00:00.000Z'),
      ('Maxwell''s Silver Hammer', 207, 3, 1, '2026-01-17T00:00:00.000Z'),
      ('Oh! Darling', 207, 4, 1, '2026-01-17T00:00:00.000Z'),
      ('Octopus''s Garden', 169, 5, 1, '2026-01-17T00:00:00.000Z'),
      ('I Want You (She''s So Heavy)', 467, 6, 1, '2026-01-17T00:00:00.000Z'),
      ('Here Comes the Sun', 185, 7, 1, '2026-01-17T00:00:00.000Z'),
      ('Because', 165, 8, 1, '2026-01-17T00:00:00.000Z'),
      ('You Never Give Me Your Money', 239, 9, 1, '2026-01-17T00:00:00.000Z'),
      ('Sun King', 146, 10, 1, '2026-01-17T00:00:00.000Z'),
      ('Mean Mr. Mustard', 68, 11, 1, '2026-01-17T00:00:00.000Z'),
      ('Polythene Pam', 75, 12, 1, '2026-01-17T00:00:00.000Z'),
      ('She Came In Through the Bathroom Window', 119, 13, 1, '2026-01-17T00:00:00.000Z'),
      ('Golden Slumbers', 90, 14, 1, '2026-01-17T00:00:00.000Z'),
      ('Carry That Weight', 97, 15, 1, '2026-01-17T00:00:00.000Z'),
      ('The End', 130, 16, 1, '2026-01-17T00:00:00.000Z'),
      ('Her Majesty', 23, 17, 1, '2026-01-17T00:00:00.000Z'),
      ('Black Dog', 296, 1, 2, '2026-01-17T00:00:00.000Z'),
      ('Rock and Roll', 219, 2, 2, '2026-01-17T00:00:00.000Z'),
      ('The Battle of Evermore', 354, 3, 2, '2026-01-17T00:00:00.000Z'),
      ('Stairway to Heaven', 482, 4, 2, '2026-01-17T00:00:00.000Z'),
      ('Misty Mountain Hop', 285, 5, 2, '2026-01-17T00:00:00.000Z'),
      ('Four Sticks', 284, 6, 2, '2026-01-17T00:00:00.000Z'),
      ('Going to California', 209, 7, 2, '2026-01-17T00:00:00.000Z'),
      ('When the Levee Breaks', 427, 8, 2, '2026-01-17T00:00:00.000Z'),
      ('Speak to Me', 90, 1, 3, '2026-01-17T00:00:00.000Z'),
      ('Breathe', 156, 2, 3, '2026-01-17T00:00:00.000Z'),
      ('On the Run', 216, 3, 3, '2026-01-17T00:00:00.000Z'),
      ('Time', 404, 4, 3, '2026-01-17T00:00:00.000Z'),
      ('The Great Gig in the Sky', 274, 5, 3, '2026-01-17T00:00:00.000Z'),
      ('Money', 382, 6, 3, '2026-01-17T00:00:00.000Z'),
      ('Us and Them', 462, 7, 3, '2026-01-17T00:00:00.000Z'),
      ('Any Colour You Like', 206, 8, 3, '2026-01-17T00:00:00.000Z'),
      ('Brain Damage', 228, 9, 3, '2026-01-17T00:00:00.000Z'),
      ('Eclipse', 123, 10, 3, '2026-01-17T00:00:00.000Z'),
      ('Sgt. Pepper''s Lonely Hearts Club Band', 120, 1, 4, '2026-01-17T00:00:00.000Z'),
      ('With a Little Help from My Friends', 159, 2, 4, '2026-01-17T00:00:00.000Z'),
      ('Lucy in the Sky with Diamonds', 209, 3, 4, '2026-01-17T00:00:00.000Z'),
      ('Getting Better', 149, 4, 4, '2026-01-17T00:00:00.000Z'),
      ('Fixing a Hole', 136, 5, 4, '2026-01-17T00:00:00.000Z'),
      ('She''s Leaving Home', 271, 6, 4, '2026-01-17T00:00:00.000Z'),
      ('Being for the Benefit of Mr. Kite!', 184, 7, 4, '2026-01-17T00:00:00.000Z'),
      ('Within You Without You', 311, 8, 4, '2026-01-17T00:00:00.000Z'),
      ('When I''m Sixty-Four', 161, 9, 4, '2026-01-17T00:00:00.000Z'),
      ('Lovely Rita', 172, 10, 4, '2026-01-17T00:00:00.000Z'),
      ('Good Morning Good Morning', 158, 11, 4, '2026-01-17T00:00:00.000Z'),
      ('Sgt. Pepper''s Lonely Hearts Club Band (Reprise)', 61, 12, 4, '2026-01-17T00:00:00.000Z'),
      ('A Day in the Life', 334, 13, 4, '2026-01-17T00:00:00.000Z')
  `);

  const executor = createSqliteExecutor(createSqliteClient(db));
  orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => {}
    }
  });
}

export function createSession() {
  if (!orm) {
    throw new Error("ORM not initialized");
  }
  return orm.createSession();
}
