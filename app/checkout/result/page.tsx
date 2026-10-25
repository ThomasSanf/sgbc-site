import Link from 'next/link';
import type { Metadata } from 'next';
import { getDb } from '@/lib/server/db';
import { authorizedOrder } from '@/lib/server/order-access';
import { publicOrderConfirmation } from '@/lib/server/order-confirmation';
import { confirmationCopy } from '@/lib/order-confirmation';
import { StoreError } from '@/lib/server/validation';
import { OrderDetails } from './order-details';
import './confirmation.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'SGBC / Order confirmation', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function CheckoutResult({ searchParams }: { searchParams: Promise<{ order?: string; token?: string; locale?: string }> }) {
  const params = await searchParams;
  const locale = params.locale === 'zh-TW' ? 'zh-TW' : 'en', copy = confirmationCopy[locale];
  let order = null;
  try { order = publicOrderConfirmation(await authorizedOrder(getDb(), { order: params.order, token: params.token })); }
  catch (error) { if (!(error instanceof StoreError && error.status === 404)) throw error; }
  return <div className="confirmation-page" lang={locale}>
    <header className="confirmation-header"><Link className="wordmark" href="/" aria-label="SGBC home">sgbc<span>™</span></Link><span className="mono">{copy.eyebrow}</span></header>
    {order ? <OrderDetails initial={order} token={params.token!} locale={locale}/> : <main className="confirmation-unavailable"><p className="mono">SGBC / CHECKOUT</p><h1>{copy.unavailable}</h1><p>{copy.unavailableBody}</p><Link className="text-link" href="/">{copy.home} →</Link></main>}
  </div>;
}
