import { and, eq } from 'drizzle-orm';
import type { StoreDatabase } from './db';
import { auditEvents } from './schema';
import { StoreError } from './validation';
import { SALES_POLICY_VERSION } from '../sales-policy-version';
import type { Locale } from '../site-copy';

type Transaction = Parameters<Parameters<StoreDatabase['transaction']>[0]>[0];
type ConsentDatabase = StoreDatabase | Transaction;
const action = 'order.policy_accepted';

export async function recordPolicyAcceptance(db: ConsentDatabase, orderId: string, locale: Locale) {
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(), actor: 'checkout', action, entityId: orderId,
    detail: JSON.stringify({ policyVersion: SALES_POLICY_VERSION, locale }), createdAt: Date.now(),
  });
}

export async function requirePolicyAcceptance(db: ConsentDatabase, orderId: string, locale: Locale) {
  const [consent] = await db.select({ id: auditEvents.id }).from(auditEvents).where(and(
    eq(auditEvents.entityId, orderId), eq(auditEvents.action, action),
    eq(auditEvents.detail, JSON.stringify({ policyVersion: SALES_POLICY_VERSION, locale })),
  )).limit(1);
  if (!consent) throw new StoreError(409, 'Please return to delivery details and accept the current sales policy.');
}
