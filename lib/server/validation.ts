import { z } from 'zod';
import { taiwanDistrict } from '../shipping';
import { SALES_POLICY_VERSION } from '../sales-policy-version';
export const productInput = z.object({
  id: z.string().uuid().optional(), version: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120), sku: z.string().trim().min(1).max(60).regex(/^[a-zA-Z0-9_-]+$/),
  description: z.string().trim().max(3000), price: z.number().int().min(0).max(100_000_000),
  currency: z.enum(['TWD', 'USD', 'EUR']), status: z.enum(['draft', 'active', 'archived']), lowStock: z.number().int().min(0).max(100_000),
}).strict();
export const inventoryInput = z.object({ productId: z.string().uuid(), delta: z.number().int().min(-100_000).max(100_000).refine(n => n !== 0, 'Enter a nonzero adjustment.'), reason: z.string().trim().min(3).max(300) }).strict();
export const reservationInput = z.object({ productId: z.string().uuid(), name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), quantity: z.number().int().min(1).max(5) }).strict();
export const preorderUpdate = z.object({ id: z.string().uuid(), status: z.enum(['new', 'contacted', 'cancelled']), notes: z.string().trim().max(2000) }).strict();
export const fulfillInput = z.object({ id: z.string().uuid(), trackingNumber: z.string().trim().min(3).max(120) }).strict();
export const deleteSandboxOrdersInput = z.object({ ids: z.array(z.uuid()).min(1).max(100) }).strict();
export const wishlistInput = z.object({ email: z.string().trim().max(254).pipe(z.email()).transform(value => value.toLowerCase()), locale: z.enum(['en', 'zh-TW', 'fr']) }).strict();
export const settingsInput = z.object({ reservationsOpen: z.boolean(), checkoutOpen: z.boolean(), shippingFeePerUnit: z.number().int().min(0).max(100_000).multipleOf(100).nullable().optional() }).strict();
export const checkoutInput = reservationInput.extend({
  requestKey: z.string().uuid(), locale: z.enum(['en', 'zh-TW']),
  policyAccepted: z.literal(true), policyVersion: z.literal(SALES_POLICY_VERSION),
}).strict();
export const shippingInput = z.object({
  phone: z.string().trim().min(8).max(24).regex(/^[+\d()\s-]+$/),
  postalCode: z.string().trim().regex(/^\d{3}(?:\d{2,3})?$/), city: z.string().trim().min(1).max(80),
  district: z.string().trim().min(1).max(80),
  address: z.string().trim().min(5).max(240), country: z.literal('TW'),
}).strict().superRefine((data, context) => {
  const district = taiwanDistrict(data.city, data.district);
  if (!district) context.addIssue({ code: 'custom', path: ['district'], message: 'Select a district in the chosen city or county.' });
  else if (!data.postalCode.startsWith(district.postalCode)) context.addIssue({ code: 'custom', path: ['postalCode'], message: 'The postal code must match the selected district.' });
});
export const paidPreorderInput = checkoutInput.extend({
  shipping: shippingInput, locale: z.enum(['en', 'zh-TW']),
  expectedTotal: z.number().int().positive().max(500_000_000),
  acknowledged: z.literal(true),
}).strict();
export class StoreError extends Error { constructor(public status: number, message: string) { super(message); } }
