import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { getAdmin } from '@/lib/server/auth';
import { authConfigured } from '@/lib/server/config';
import { LoginButton } from './sign-in';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdmin(await headers())) redirect('/admin/');
  const ready = authConfigured(), { error } = await searchParams;
  return <main className="admin-login">
    <Link className="admin-brand" href="/">sgbc<span>™</span></Link>
    <div className="login-grid">
      <section className="login-intro"><span className="admin-eyebrow">THE CONTROL ROOM / 01</span><h1>Your store.<br/><span>In good hands.</span></h1><p>Products, preorders, and every detail<br/>between an idea and its next home.</p><div className="login-footnote"><span className="admin-dot"/> SGBC STORE OPERATIONS</div></section>
      <section className="login-card"><div className="admin-icon-box"><LockKeyhole size={22}/></div><span className="admin-eyebrow">AUTHORIZED PERSONNEL</span><h2>Welcome back.</h2><p>Sign in with your approved Google account to manage the SGBC store.</p>{error && <div className="admin-alert" role="alert">Sign-in could not be completed. Use an approved admin account and try again.</div>}<LoginButton ready={ready}/>{!ready && <div className="admin-notice">Admin sign-in is being configured. Access stays locked until setup is complete.</div>}<div className="login-security"><ShieldCheck size={17}/><span>Restricted access. No public registration.</span></div><Link className="admin-text-link" href="/">Back to the store <ArrowUpRight size={16}/></Link></section>
    </div><footer className="admin-login-footer">SGBC / INDEPENDENT HARDWARE<span>STORE ADMIN</span></footer>
  </main>;
}
