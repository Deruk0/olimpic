import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

async function checkDatabase(db) {
  const { rows } = await db.query("SELECT to_regclass('groups') IS NOT NULL AS legacy");
  if (rows[0].legacy) {
    throw new Error('Это база старого прототипа. Укажите пустую БД или новый каталог PGlite.');
  }
}

async function connect() {
  const schema = await readFile(resolve('lib/schema.sql'), 'utf8');
  if (!process.env.DATABASE_URL) {
    const directory = resolve(/* turbopackIgnore: true */ process.env.OLIMPIK_DATA_DIR || 'data/olimpik-lms');
    await mkdir(dirname(directory), { recursive: true });
    const db = new PGlite(directory);
    try {
      await checkDatabase(db);
      await db.exec(schema);
    } catch (error) {
      await db.close();
      throw error;
    }
    return db;
  }
  const connectionString = new URL(process.env.DATABASE_URL);
  const sslMode = connectionString.searchParams.get('sslmode');
  if (!connectionString.searchParams.has('uselibpqcompat') && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
    connectionString.searchParams.set('sslmode', 'verify-full');
  }
  const pool = new pg.Pool({ connectionString: connectionString.toString() });
  try {
    await checkDatabase(pool);
    await pool.query(schema);
  } catch (error) {
    await pool.end();
    throw error;
  }
  return {
    query: (sql, params) => pool.query(sql, params),
    async transaction(run) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await run(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end()
  };
}
export function database() {
  globalThis.olimpikDatabase ??= connect();
  return globalThis.olimpikDatabase;
}
