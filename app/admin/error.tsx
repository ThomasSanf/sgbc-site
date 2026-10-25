'use client';
export default function AdminError({ reset }: { reset: () => void }) { return <main className="admin-error"><h1>We couldn’t load the store.</h1><p>Check that the database is configured and migrations have been applied, then try again.</p><button className="admin-button" onClick={reset}>Try again</button></main>; }
