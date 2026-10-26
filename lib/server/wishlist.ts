import { wishlist, auditEvents } from './schema';
import type { StoreDatabase } from './db';
import { wishlistInput } from './validation';

export async function joinWishlist(db: StoreDatabase, raw: unknown) {
  const data = wishlistInput.parse(raw), now = Date.now();
  await db.transaction(async tx => {
    const [created] = await tx.insert(wishlist).values({ id: crypto.randomUUID(), ...data, consentVersion: '2026-10-26', createdAt: now }).onConflictDoNothing({ target: wishlist.email }).returning({ id: wishlist.id });
    if (created) await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actor: 'storefront', action: 'wishlist.joined', entityId: created.id, detail: 'A visitor joined the SGBC availability wishlist.', createdAt: now });
  });
  // Always acknowledge identically; never expose whether an email already exists.
  return { ok: true };
}
