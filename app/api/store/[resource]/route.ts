import { and, eq, ne, sql } from 'drizzle-orm';
import { getDb } from '@/lib/server/db';
import { apiError, input, json, limitPublicRequest, verifyOrigin } from '@/lib/server/http';
import { createReservation, storeSettings } from '@/lib/server/store';
import { products } from '@/lib/server/schema';
import { paidPreorderInput, reservationInput, StoreError } from '@/lib/server/validation';
import { createCheckout } from '@/lib/server/payments';
import { paymentsConfigured, paymentProvider, ecpayEnvironment } from '@/lib/server/config';
import { publicSandboxMode, SANDBOX_PRODUCT_ID, checkoutSettingsId } from '@/lib/server/sandbox';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ resource: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    if ((await context.params).resource !== 'catalog') throw new StoreError(404, 'Not found.');
    const db = getDb(), config = await storeSettings(db, checkoutSettingsId());
    const allocation = publicSandboxMode() ? eq(products.id, SANDBOX_PRODUCT_ID) : ne(products.id, SANDBOX_PRODUCT_ID);
    const catalog = await db.select({ id: products.id, name: products.name, description: products.description, price: products.price, currency: products.currency, available: sql<number>`${products.stock} - ${products.reserved}` }).from(products).where(and(eq(products.status, 'active'), allocation)).limit(100);
    return json({ products: catalog, reservationsOpen: config.reservationsOpen, checkoutOpen: config.checkoutOpen && paymentProvider() === 'ecpay' && paymentsConfigured() && config.shippingFeePerUnit !== null, shippingFeePerUnit: config.shippingFeePerUnit, sandbox: ecpayEnvironment() === 'stage' && paymentsConfigured() });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    verifyOrigin(request);
    const { resource } = await context.params;
    if (!['preorders', 'checkout'].includes(resource)) throw new StoreError(404, 'Not found.');
    await limitPublicRequest(request, resource);
    if (resource === 'preorders') {
      if (publicSandboxMode()) throw new StoreError(409, 'Unpaid reservations are closed during public testing.');
      await createReservation(getDb(), 'storefront', await input(request, reservationInput), true);
      return json({ ok: true, message: 'Your reservation request has been received. No payment has been taken.' }, 202);
    }
    if (paymentProvider() !== 'ecpay') throw new StoreError(503, 'Storefront card checkout is not configured.');
    return json(await createCheckout(await input(request, paidPreorderInput)));
  } catch (error) { return apiError(error); }
}
