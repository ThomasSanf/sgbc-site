import { existsSync } from 'node:fs';
import { migrate } from 'drizzle-orm/libsql/migrator';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const { getDb } = await import('../lib/server/db');
const { products, settings } = await import('../lib/server/schema');
const db = getDb();
await migrate(db, { migrationsFolder: './drizzle' });
const now = Date.now();
await db.insert(settings).values({ id: 'store', reservationsOpen: false, checkoutOpen: false, updatedAt: now }).onConflictDoNothing();
// Seed only a draft of the actual product. No invented price, orders, or stock.
await db.insert(products).values({ id: 'cbe15421-859d-4de5-bcad-1f0e34a7a80e', sku: 'SGBC-REV-C', name: 'SGBC Console · Rev C', description: 'FPGA console with classic gray enclosure, black base, and Bordeaux controls.', status: 'draft', price: 0, currency: 'TWD', createdAt: now, updatedAt: now }).onConflictDoNothing();
db.$client.close();
console.log('Database migrated. The SGBC product is a draft and checkout remains closed.');
