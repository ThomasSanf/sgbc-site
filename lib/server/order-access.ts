import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { appOrigin } from './config';
import type { StoreDatabase } from './db';
import { orders } from './schema';
import { StoreError } from './validation';

type Order = typeof orders.$inferSelect;
export const ORDER_LINK_LIFETIME = 180 * 24 * 60 * 60 * 1000;
export const orderAccessInput = z.object({ order: z.uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export function orderAccessToken(order: Pick<Order, 'id' | 'requestKey' | 'createdAt'>) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new StoreError(503, 'Order confirmation is not configured.');
  // A read-only capability, separate from the key that permits checkout submission.
  return createHmac('sha256', secret).update(`sgbc-order-confirmation-v1:${order.id}:${order.requestKey}:${order.createdAt}`).digest('base64url');
}
export function confirmationUrl(order: Order, path = '/checkout/result/') {
  return `${appOrigin()}${path}?order=${order.id}&token=${orderAccessToken(order)}&locale=${order.locale === 'zh-TW' ? 'zh-TW' : 'en'}`;
}
export async function authorizedOrder(db: StoreDatabase, raw: unknown, now = Date.now()) {
  const parsed = orderAccessInput.safeParse(raw);
  if (!parsed.success) throw new StoreError(404, 'This order confirmation link is unavailable.');
  const [order] = await db.select().from(orders).where(eq(orders.id, parsed.data.order));
  if (!order || now >= order.createdAt + ORDER_LINK_LIFETIME || !timingSafeEqual(Buffer.from(parsed.data.token), Buffer.from(orderAccessToken(order)))) throw new StoreError(404, 'This order confirmation link is unavailable.');
  return order;
}
export const privateOrderHeaders = {
  'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive', 'X-Content-Type-Options': 'nosniff',
};
