// The public demo uses its own product/allocation and settings in the same database.
// These IDs must never be used for live checkout or unpaid reservations.
export const SANDBOX_PRODUCT_ID = '66c1bc4c-0797-4707-9fa2-976b4b1dbce5';
export const SANDBOX_SETTINGS_ID = 'ecpay-sandbox';
export function publicSandboxMode() { return process.env.PUBLIC_ECPAY_SANDBOX === 'true'; }
export function checkoutSettingsId() { return publicSandboxMode() ? SANDBOX_SETTINGS_ID : 'store'; }

// Published by ECPay for testing; these are not merchant secrets.
export const publicEcpaySandbox = { merchantId: '3002607', hashKey: 'pwFHCqoQZGmho4w6', hashIV: 'EkRm7iFT261dpevs', environment: 'stage' as const };
