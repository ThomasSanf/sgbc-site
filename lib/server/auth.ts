import 'server-only';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import * as schema from './schema';
import { appOrigin, authConfigured, isApprovedAdmin } from './config';

let instance: ReturnType<typeof betterAuth> | undefined;
export function getAuth() {
  if (!authConfigured()) return null;
  if (instance) return instance;
  const origin = appOrigin();
  const options: BetterAuthOptions = {
    appName: 'SGBC Admin', baseURL: origin, secret: process.env.BETTER_AUTH_SECRET!,
    database: drizzleAdapter(getDb(), { provider: 'sqlite', schema }),
    trustedOrigins: [origin],
    socialProviders: { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, prompt: 'select_account' } },
    emailAndPassword: { enabled: false },
    user: { validateUserInfo: ({ user }) => {
      if (!user.email || !isApprovedAdmin(user.email, user.emailVerified === true)) return { error: 'admin_access_denied', errorDescription: 'This account does not have admin access.' };
    } },
    onAPIError: { errorURL: '/admin/login/' },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 30, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: origin.startsWith('https:'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
    },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 60, customRules: { '/sign-in/social': { window: 60, max: 8 } } },
    databaseHooks: {
      user: { create: { before: async newUser => {
        if (!isApprovedAdmin(newUser.email, newUser.emailVerified)) throw new APIError('FORBIDDEN', { message: 'This account does not have admin access.' });
        return { data: newUser };
      } } },
      session: { create: { before: async newSession => {
        const [admin] = await getDb().select().from(schema.user).where(eq(schema.user.id, newSession.userId));
        if (!admin || !isApprovedAdmin(admin.email, admin.emailVerified)) throw new APIError('FORBIDDEN', { message: 'This account does not have admin access.' });
        return { data: newSession };
      } } },
    },
  };
  instance = betterAuth(options);
  return instance;
}
export async function getAdmin(headers: Headers) {
  const auth = getAuth();
  if (!auth) return null;
  const session = await auth.api.getSession({ headers });
  if (!session || !isApprovedAdmin(session.user.email, session.user.emailVerified)) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}
