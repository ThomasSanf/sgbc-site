import { getDb } from '@/lib/server/db';
import { apiError, input, json, requireAdmin } from '@/lib/server/http';
import { integrationStatus, paymentsConfigured, paymentProvider } from '@/lib/server/config';
import { adjustInventory, createReservation, dashboardData, fulfillOrder, listRecords, saveProduct, updateReservation, updateSettings } from '@/lib/server/store';
import { checkoutInput, fulfillInput, inventoryInput, preorderUpdate, productInput, reservationInput, settingsInput, StoreError } from '@/lib/server/validation';
import { createCheckout, reconcileOrder } from '@/lib/server/payments';
import { z } from 'zod';
import { visitorStats } from '@/lib/server/visitor-analytics';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { resource } = await context.params;
    if (resource === 'dashboard') return json({ ...await dashboardData(getDb()), integrations: integrationStatus() });
    if (resource === 'visitors') return json(await visitorStats(getDb()));
    const url = new URL(request.url);
    const page = z.coerce.number().int().min(1).max(100000).parse(url.searchParams.get('page') ?? 1);
    const query = z.string().max(120).parse(url.searchParams.get('q') ?? '');
    return json(await listRecords(getDb(), resource, query, page));
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const admin = await requireAdmin(request), { resource } = await context.params, db = getDb();
    if (resource === 'products') return json(await saveProduct(db, admin.email, await input(request, productInput)));
    if (resource === 'inventory') return json(await adjustInventory(db, admin.email, await input(request, inventoryInput)));
    if (resource === 'preorders') return json({ id: await createReservation(db, admin.email, await input(request, reservationInput)) });
    if (resource === 'orders') {
      if (paymentProvider() !== 'stripe') throw new StoreError(409, 'Customers should use the storefront preorder button to enter delivery details and open ECPay.');
      return json(await createCheckout(await input(request, checkoutInput)));
    }
    if (resource === 'reconcile') return json(await reconcileOrder((await input(request, z.object({ id: z.string().uuid() }).strict())).id));
    throw new StoreError(404, 'Action not found.');
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const admin = await requireAdmin(request), { resource } = await context.params, db = getDb();
    if (resource === 'preorders') return json(await updateReservation(db, admin.email, await input(request, preorderUpdate)));
    if (resource === 'orders') return json(await fulfillOrder(db, admin.email, await input(request, fulfillInput)));
    if (resource === 'settings') return json(await updateSettings(db, admin.email, await input(request, settingsInput), paymentsConfigured()));
    throw new StoreError(404, 'Action not found.');
  } catch (error) { return apiError(error); }
}
