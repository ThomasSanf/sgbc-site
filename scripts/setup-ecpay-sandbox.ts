import { existsSync } from 'node:fs';
import { getDb } from '../lib/server/db';
import { products, settings, auditEvents } from '../lib/server/schema';
import { SANDBOX_PRODUCT_ID, SANDBOX_SETTINGS_ID } from '../lib/server/sandbox';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const db = getDb(), now = Date.now();
try {
  await db.transaction(async tx => {
    await tx.insert(products).values({ id: SANDBOX_PRODUCT_ID, sku: 'SGBC-REV-C-SANDBOX', name: 'SGBC Console · Rev C', description: 'Test checkout allocation. No real inventory or shipment.', price: 550000, currency: 'TWD', status: 'active', stock: 200, createdAt: now, updatedAt: now }).onConflictDoNothing();
    await tx.insert(settings).values({ id: SANDBOX_SETTINGS_ID, reservationsOpen: false, checkoutOpen: true, shippingFeePerUnit: 8000, updatedAt: now }).onConflictDoNothing();
    await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actor: 'setup', action: 'sandbox.prepared', entityId: SANDBOX_PRODUCT_ID, detail: 'Dedicated test allocation · NT$5,500 + NT$80 test delivery. Real inventory and checkout settings unchanged.', createdAt: now });
  });
  console.log('Public ECPay test allocation is prepared. Enable PUBLIC_ECPAY_SANDBOX=true to open it.');
} finally { db.$client.close(); }
