import { and, eq, ne, sql } from 'drizzle-orm';
import { getDb } from '@/lib/server/db';
import { apiError, input, json, limitPublicRequest, verifyOrigin } from '@/lib/server/http';
import { storeSettings } from '@/lib/server/store';
import { products } from '@/lib/server/schema';
import { wishlistInput, StoreError } from '@/lib/server/validation';
import { joinWishlist } from '@/lib/server/wishlist';
import { STOREFRONT_MODE } from '@/lib/storefront-mode';
import { paymentsConfigured, ecpayEnvironment } from '@/lib/server/config';
import { publicSandboxMode, SANDBOX_PRODUCT_ID, checkoutSettingsId } from '@/lib/server/sandbox';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Context = { params: Promise<{ resource: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    if ((await context.params).resource !== 'catalog') throw new StoreError(404, 'Not found.');
    const db = getDb(), config = await storeSettings(db, checkoutSettingsId());
    const allocation = publicSandboxMode() ? eq(products.id, SANDBOX_PRODUCT_ID) : ne(products.id, SANDBOX_PRODUCT_ID);
    const catalog = await db.select({ id: products.id, name: products.name, description: products.description, price: products.price, currency: products.currency, available: sql<number>`${products.stock} - ${products.reserved}` }).from(products).where(and(eq(products.status, 'active'), allocation)).limit(100);
    return json({ products: catalog, reservationsOpen: false, checkoutOpen: false, mode: STOREFRONT_MODE, shippingFeePerUnit: config.shippingFeePerUnit, sandbox: ecpayEnvironment() === 'stage' && paymentsConfigured() });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    verifyOrigin(request);
    const { resource } = await context.params;
    if (!['wishlist', 'preorders', 'checkout'].includes(resource)) throw new StoreError(404, 'Not found.');
    if (resource !== 'wishlist') throw new StoreError(409, 'Ordering is paused. Please join the wishlist for availability updates.');
    await limitPublicRequest(request, resource);
    return json(await joinWishlist(getDb(), await input(request, wishlistInput)), 202);
  } catch (error) { return apiError(error); }
}
