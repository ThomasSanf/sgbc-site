# Wishlist launch

The public storefront currently uses an email-only wishlist in English and Traditional Chinese (Taiwan). Signups are stored in the `wishlist` table, normalized and deduplicated by email. Each record includes its language, signup time, and availability-update consent version. No payment or stock hold is created. No automated email is sent.

Approved admins can search and paginate signups in **Admin → Wishlist**. The overview shows the unique email total. Signup endpoints enforce same-origin requests, input validation, and rate limits. Email lists are not public.

Apply `pnpm db:migrate` to the intended database before deploying this version. Migration `0005_cold_masked_marvel.sql` only adds the wishlist table and indexes; it preserves orders, stock, reservations, and analytics.

## Production address

`https://sgbc.tw` redirects to `https://www.sgbc.tw`. Set production `BETTER_AUTH_URL=https://www.sgbc.tw` and register `https://www.sgbc.tw/api/auth/callback/google` in the existing Google OAuth client. Use `https://www.sgbc.tw/admin/` to sign in. Sessions on the old Vercel domain do not carry over; sign in again on the new domain. Keep the admin email allowlist and other credentials unchanged.

## Returning to ordering later

Public `/api/store/checkout/` and `/api/store/preorders/` requests are paused, including sandbox checkout. Existing payment callbacks and order confirmations remain available. Saved checkout settings do not override this pause. Restoring ordering requires changing the storefront mode, reinstating the checkout API and buttons, and reviewing checkout settings. Retain the wishlist and existing orders when doing so.
