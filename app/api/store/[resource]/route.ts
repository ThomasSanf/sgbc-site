import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/server/db';
import { apiError, input, json, limitPublicRequest, verifyOrigin } from '@/lib/server/http';
import { createReservation, storeSettings } from '@/lib/server/store';
import { products } from '@/lib/server/schema';
import { checkoutInput, reservationInput, StoreError } from '@/lib/server/validation';
import { createCheckout } from '@/lib/server/payments';
import { paymentsConfigured } from '@/lib/server/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ resource: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    if ((await context.params).resource !== 'catalog') throw new StoreError(404, 'Not found.');
    const db = getDb(), config = await storeSettings(db);
    const catalog = await db.select({ id: products.id, name: products.name, description: products.description, price: products.price, currency: products.currency }).from(products).where(eq(products.status, 'active')).limit(100);
    return json({ products: catalog, reservationsOpen: config.reservationsOpen, checkoutOpen: config.checkoutOpen && paymentsConfigured() });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    verifyOrigin(request);
    const { resource } = await context.params;
    if (!['preorders', 'checkout'].includes(resource)) throw new StoreError(404, 'Not found.');
    await limitPublicRequest(request, resource);
    if (resource === 'preorders') {
      await createReservation(getDb(), 'storefront', await input(request, reservationInput), true);
      return json({ ok: true, message: 'Your reservation request has been received. No payment has been taken.' }, 202);
    }
    return json(await createCheckout(await input(request, checkoutInput)));
  } catch (error) { return apiError(error); }
}
