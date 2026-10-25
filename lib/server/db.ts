import { mkdirSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

export function connectDatabase(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}
export type StoreDatabase = ReturnType<typeof connectDatabase>;
let instance: StoreDatabase | undefined;
export function getDb() {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured. Run the admin setup guide.');
  if (process.env.VERCEL && url.startsWith('file:')) throw new Error('Vercel requires a persistent hosted database. Local files are not supported.');
  if (url === 'file:.data/store.db') mkdirSync('.data', { recursive: true });
  instance = connectDatabase(url, process.env.DATABASE_AUTH_TOKEN);
  return instance;
}
