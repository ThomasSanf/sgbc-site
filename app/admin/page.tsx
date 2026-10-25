import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/server/auth';
import { getDb } from '@/lib/server/db';
import { dashboardData } from '@/lib/server/store';
import { adminEmails, authConfigured, paymentsConfigured } from '@/lib/server/config';
import { AdminDashboard } from './dashboard';
export default async function AdminPage() {
  const admin = await getAdmin(await headers());
  if (!admin) redirect('/admin/login/');
  const data = await dashboardData(getDb());
  return <AdminDashboard admin={admin} initial={{ ...data, integrations: { google: authConfigured(), stripe: paymentsConfigured(), hostedDatabase: !process.env.DATABASE_URL?.startsWith('file:'), adminEmails: adminEmails() } }}/>;
}
