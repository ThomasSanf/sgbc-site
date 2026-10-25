export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
}
export function isApprovedAdmin(email: string, verified: boolean) {
  return verified === true && adminEmails().includes(email.trim().toLowerCase());
}
export function appOrigin() {
  const value = process.env.BETTER_AUTH_URL;
  if (!value) throw new Error('BETTER_AUTH_URL is not configured.');
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:' && !process.env.VERCEL)) throw new Error('The application URL must use HTTPS.');
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an origin without a path for BETTER_AUTH_URL.');
  return url.origin;
}
export function authConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32 && process.env.BETTER_AUTH_URL && adminEmails().length);
}
export function stripeConfigured() { return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET); }
export function paymentProvider() { return process.env.PAYMENT_PROVIDER === 'stripe' ? 'stripe' : 'ecpay'; }
export function ecpayEnvironment() { return process.env.ECPAY_ENVIRONMENT === 'live' ? 'live' : 'stage'; }
export function ecpayConfigured() {
  const { ECPAY_MERCHANT_ID: id, ECPAY_HASH_KEY: key, ECPAY_HASH_IV: iv, ECPAY_ENVIRONMENT: environment } = process.env;
  if (!id || !/^\d{7,10}$/.test(id) || !key || !iv || !['stage', 'live'].includes(environment ?? '')) return false;
  // Public sandbox credentials must never authorize real orders or production checkout.
  const testIds = ['3002607', '2000132', '3002599', '3003008', '3085779', '3365120'];
  if (environment === 'live' && (testIds.includes(id) || key === 'pwFHCqoQZGmho4w6' || iv === 'EkRm7iFT261dpevs')) return false;
  if (environment === 'stage' && process.env.VERCEL_ENV === 'production') return false;
  return true;
}
export function paymentsConfigured() { return paymentProvider() === 'ecpay' ? ecpayConfigured() : stripeConfigured(); }
export function integrationStatus() {
  return { google: authConfigured(), stripe: stripeConfigured(), payments: paymentsConfigured(), provider: paymentProvider(), environment: ecpayEnvironment(), hostedDatabase: !process.env.DATABASE_URL?.startsWith('file:'), adminEmails: adminEmails() };
}
