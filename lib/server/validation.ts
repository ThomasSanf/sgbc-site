import { z } from 'zod';
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
export const settingsInput = z.object({ reservationsOpen: z.boolean(), checkoutOpen: z.boolean() }).strict();
export const checkoutInput = reservationInput.extend({ requestKey: z.string().uuid() }).strict();
export class StoreError extends Error { constructor(public status: number, message: string) { super(message); } }
