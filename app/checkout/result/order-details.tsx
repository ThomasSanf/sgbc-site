'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Download, LoaderCircle, Package, RefreshCw } from 'lucide-react';
import { confirmationCopy, orderDate, orderMoney, type OrderConfirmation } from '@/lib/order-confirmation';
import type { Locale } from '@/lib/site-copy';

export function OrderDetails({ initial, token, locale }: { initial: OrderConfirmation; token: string; locale: Locale }) {
  const [order, setOrder] = useState(initial), [checking, setChecking] = useState(false), [checkError, setCheckError] = useState(false), [waiting, setWaiting] = useState(false);
  const [downloading, setDownloading] = useState(false), [downloadError, setDownloadError] = useState(false);
  const checkingRef = useRef(false);
  const copy = confirmationCopy[locale], money = (amount: number) => orderMoney(amount, order.currency, locale);
  const access = new URLSearchParams({ order: order.id, token, locale }).toString();
  const paid = order.status === 'paid' || order.status === 'fulfilled';
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (checkingRef.current) return;
    checkingRef.current = true; setChecking(true); setCheckError(false);
    try {
      const response = await fetch('/api/store/order-confirmation/', { method: 'POST', signal, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: initial.id, token }) });
      if (!response.ok) throw new Error();
      setOrder(await response.json());
    } catch { if (!signal?.aborted) setCheckError(true); }
    finally { checkingRef.current = false; if (!signal?.aborted) setChecking(false); }
  }, [initial.id, token]);
  useEffect(() => {
    if (initial.status !== 'pending') return;
    const controller = new AbortController();
    const timer = setTimeout(() => { void refresh(controller.signal); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [initial.status, refresh]);
  useEffect(() => {
    if (order.status !== 'pending') return;
    let attempts = 0;
    const controller = new AbortController();
    const timer = setInterval(() => {
      if (++attempts > 15) { clearInterval(timer); setWaiting(true); return; }
      void fetch(`/api/store/order-confirmation/?${access}`, { signal: controller.signal, cache: 'no-store', credentials: 'same-origin' })
        .then(async response => { if (response.ok) setOrder(await response.json()); })
        .catch(() => { /* Keep the last verified state while notifications arrive. */ });
    }, 4000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [order.status, access]);
  async function download() {
    if (downloading) return;
    setDownloading(true); setDownloadError(false);
    try {
      const response = await fetch(`/api/store/order-receipt/?${access}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `SGBC-${order.reference}.pdf`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setDownloadError(true); }
    finally { setDownloading(false); }
  }
  const address = order.shipping;
  return <main className="confirmation-main">
    <div className="confirmation-intro"><output className={`confirmation-status${paid ? ' is-paid' : ''}`}>{paid ? <Check size={17}/> : <Package size={17}/>} {copy[order.status]}</output><h1>{paid ? copy.title : copy[order.status]}</h1><p>{paid ? order.sandbox ? copy.sandboxPaid : copy.paidBody : order.status === 'pending' ? copy.pendingBody : order.status === 'cancelled' ? copy.cancelledBody : copy.refundedBody}</p></div>
    {order.sandbox && <div className="confirmation-sandbox">{copy.sandbox}</div>}
    <section className="confirmation-card" aria-label={copy.document}>
      <div className="confirmation-order-meta"><div><span>{copy.order}</span><strong>{order.reference}</strong></div><div><span>{copy.date}</span><strong>{orderDate(order.createdAt, locale)}</strong></div></div>
      <div className="confirmation-product"><div className="confirmation-product-icon"><Package size={35}/></div><div><span className="mono">{copy.product}</span><h2>{order.productName}</h2><p>{order.sku}</p><p>{copy.quantity}: {order.quantity} · {copy.unitPrice}: {money(order.unitPrice)}</p></div><strong>{money(order.subtotal)}</strong></div>
      <dl className="confirmation-totals"><div><dt>{copy.subtotal}</dt><dd>{money(order.subtotal)}</dd></div><div><dt>{copy.shippingFee}</dt><dd>{money(order.shippingFee)}</dd></div><div className="confirmation-total"><dt>{copy.total}</dt><dd>{money(order.total)}</dd></div>{order.refundedAmount > 0 && <div><dt>{copy.refund}</dt><dd>{money(order.refundedAmount)}</dd></div>}</dl>
      <div className="confirmation-details"><section><h2>{copy.customer}</h2><p>{order.name}<br/>{order.email}</p><h2>{copy.payment}</h2><p>{order.provider === 'ecpay' ? 'ECPay' : 'Stripe'} · {copy.method}<br/>{copy[order.status]}</p>{order.paymentReference && <><h2>{copy.reference}</h2><p>{order.paymentReference}</p></>}</section><section><h2>{copy.delivery}</h2>{address ? <p>{order.name}<br/>{address.phone}<br/>{address.postalCode} {address.city} {address.district}<br/>{address.address}<br/>{address.country === 'TW' ? copy.taiwan : address.country}</p> : <p>{copy.noAddress}</p>}{order.trackingNumber && <><h2>{copy.tracking}</h2><p>{order.trackingNumber}</p></>}</section></div>
      <p className="confirmation-preorder">{copy.preorder}</p>
    </section>
    <div className="confirmation-actions"><button className="confirmation-download" onClick={download} disabled={downloading}>{downloading ? <LoaderCircle size={18} className="preorder-spinner"/> : <Download size={18}/>} {downloading ? copy.downloading : copy.download}</button>{order.status === 'pending' && <button className="text-link" onClick={() => { void refresh(); }} disabled={checking}>{checking ? <LoaderCircle size={16} className="preorder-spinner"/> : <RefreshCw size={16}/>} {checking ? copy.checking : copy.refresh}</button>}<Link className="text-link" href="/">{copy.home}<ArrowUpRight size={17}/></Link></div>
    {downloadError && <p className="confirmation-error" role="alert">{copy.downloadError}</p>}{checkError && order.status === 'pending' && <p className="confirmation-error" role="alert">{copy.checkError}</p>}{waiting && order.status === 'pending' && <output className="confirmation-notice">{copy.waiting}</output>}
    <footer className="confirmation-footer"><p>{copy.private}</p><Link href={`/sales-policy/${locale}/`}>{copy.policy}<ArrowUpRight size={14} aria-hidden="true"/></Link></footer>
  </main>;
}
