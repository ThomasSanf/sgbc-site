'use client';
import { useState } from 'react';
import { createAuthClient } from 'better-auth/react';
const authClient = createAuthClient();
export function LoginButton({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function signIn() {
    setBusy(true); setError('');
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/admin/', errorCallbackURL: '/admin/login/' });
      if (result.error) { setError('Sign-in is unavailable. Please try again.'); setBusy(false); }
    } catch { setError('Unable to connect. Please try again.'); setBusy(false); }
  }
  return <><button className="admin-button google-button" type="button" disabled={!ready || busy} onClick={signIn}><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36ZM12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.61 0-4.82-1.76-5.61-4.12H3.05v2.6A10 10 0 0 0 12 22ZM6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93v-2.6H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.53l3.34-2.6ZM12 5.95c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.47l3.34 2.6C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>{busy ? 'Connecting…' : 'Continue with Google'}</button>{error && <p className="admin-alert" role="alert">{error}</p>}</>;
}
