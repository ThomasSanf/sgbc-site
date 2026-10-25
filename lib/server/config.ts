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
export function paymentsConfigured() { return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET); }
