import { database } from "./db.mjs";

export interface Connection {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}
export async function rows<T>(sql: string, params: unknown[] = [], connection?: Connection): Promise<T[]> {
  return (await (connection ?? await database()).query(sql, params)).rows as T[];
}
export async function first<T>(sql: string, params: unknown[] = [], connection?: Connection): Promise<T | undefined> {
  return (await rows<T>(sql, params, connection))[0];
}
export async function transaction<T>(run: (connection: Connection) => Promise<T>): Promise<T> {
  return (await database()).transaction(run) as Promise<T>;
}
