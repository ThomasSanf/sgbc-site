'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CreditCard, LoaderCircle, LockKeyhole } from 'lucide-react';
import { siteCopy, type Locale } from '@/lib/site-copy';
import type { EmbeddedCheckout } from '@/lib/storefront-types';

type PaymentInfo = { PayToken: string; MerchantTradeNo: string; PaymentType: string };
type EcpaySdk = {
  Language: { zhTW: string; enUS: string };
  initialize: (environment: 'Stage' | 'Prod', loading: number, callback: (error?: string) => void) => void;
  createPayment: (token: string, language: string, callback: (error?: string) => void, version: 'V2') => void;
  getPayToken: (callback: (info: PaymentInfo | null, error?: string) => void) => void;
};
declare global { interface Window { ECPay?: EcpaySdk } }

export function EmbeddedPayment({ checkout, requestKey, locale, onEdit, onBusy }: {
  checkout: EmbeddedCheckout; requestKey: string; locale: Locale; onEdit: () => void; onBusy: (busy: boolean) => void;
}) {
  const copy = siteCopy[locale].preorder;
  const [jqueryReady, setJqueryReady] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [expired, setExpired] = useState(false);
  const [retry, setRetry] = useState(0);
  const active = useRef(true);
  const submitting = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value / 100);
  const resultUrl = checkout.confirmationUrl;

  useEffect(() => {
    active.current = true;
    root.current?.scrollIntoView({ block: 'start' });
    root.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => setExpired(true), Math.max(0, checkout.expiresAt - Date.now()));
    return () => { active.current = false; clearTimeout(timer); };
  }, [checkout.expiresAt]);

  useEffect(() => {
    if (!sdkReady || !window.ECPay) return;
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setError(copy.paymentLoadFailed); }, 30_000);
    const sdk = window.ECPay;
    sdk.initialize(checkout.environment === 'stage' ? 'Stage' : 'Prod', 0, error => {
      if (cancelled) return;
      if (error) { clearTimeout(timer); setError(copy.paymentLoadFailed); return; }
      sdk.createPayment(checkout.token, locale === 'en' ? sdk.Language.enUS : sdk.Language.zhTW, error => {
        if (cancelled) return;
        clearTimeout(timer);
        if (error) setError(copy.paymentLoadFailed);
        else { setReady(true); setError(''); }
      }, 'V2');
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sdkReady, checkout.token, checkout.environment, locale, copy.paymentLoadFailed, retry]);

  function setWorking(value: boolean) { setBusy(value); onBusy(value); }
  async function edit() {
    if (submitting.current || submitted) return;
    submitting.current = true; setWorking(true); setError('');
    try {
      const response = await fetch('/api/store/ecpg-cancel/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: checkout.orderId, requestKey }) });
      if (!response.ok) throw new Error();
      onEdit();
    } catch { setError(copy.paymentEditFailed); }
    finally { submitting.current = false; setWorking(false); }
  }
  function pay() {
    if (!ready || submitting.current || expired || submitted || !window.ECPay) return;
    submitting.current = true; setWorking(true); setError('');
    let callbackReceived = false;
    const timer = setTimeout(() => {
      if (!callbackReceived && active.current) { callbackReceived = true; submitting.current = false; setWorking(false); setError(copy.paymentLoadFailed); }
    }, 30_000);
    window.ECPay.getPayToken(async (info, providerError) => {
      if (callbackReceived || !submitting.current) return;
      callbackReceived = true; clearTimeout(timer);
      if (!active.current) return;
      try {
        if (providerError || !info || info.PaymentType !== 'CreditCard' || info.MerchantTradeNo !== checkout.merchantTradeNo) { setError(copy.paymentInvalid); return; }
        setSubmitted(true);
        const response = await fetch('/api/store/ecpg-payment/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: checkout.orderId, requestKey, payToken: info.PayToken }) });
        if (!response.ok) throw new Error();
        const data: { url: string } = await response.json();
        const url = new URL(data.url);
        if (url.origin !== window.location.origin && (url.protocol !== 'https:' || !url.hostname.endsWith('.ecpay.com.tw') || url.username || url.password || url.port)) throw new Error();
        window.location.assign(url.href);
      } catch { setError(copy.paymentUncertain); }
      finally { submitting.current = false; setWorking(false); }
    });
  }
  const summary = checkout.summary;
  return <div className="embedded-payment" ref={root} tabIndex={-1}>
    <ol className="checkout-steps" aria-label={copy.stepsLabel}><li>{copy.detailsStep}<span>✓</span></li><li aria-current="step">{copy.paymentStep}<span>02</span></li></ol>
    <div className="payment-heading"><CreditCard size={22}/><h2>{copy.paymentTitle}</h2><LockKeyhole size={16}/></div>
    <div className="payment-summary"><div><span className="mono">{copy.shipTo}</span><strong>{summary.name}</strong><p>{summary.address.postalCode} {summary.address.city}{summary.address.district}<br/>{summary.address.address}</p><p>{summary.email}</p></div><button type="button" className="payment-edit" onClick={edit} disabled={busy || submitted}><ArrowLeft size={14}/>{copy.editDetails}</button></div>
    <div className="payment-card-panel" aria-busy={!ready}>
      {!ready && !error && <output className="payment-loading"><LoaderCircle size={18} className="preorder-spinner"/>{copy.paymentLoading}</output>}
      <div id="ECPayPayment"/>
    </div>
    {checkout.environment === 'stage' && <output className="preorder-sandbox"><strong>{copy.sandbox}</strong><code>4311 9522 2222 2222</code><span>{copy.testDetails}</span></output>}
    <Script id="ecpg-jquery" src="https://code.jquery.com/jquery-3.5.1.min.js" integrity="sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=" crossOrigin="anonymous" onReady={() => setJqueryReady(true)} onError={() => setError(copy.paymentLoadFailed)}/>
    {jqueryReady && <Script id="ecpg-sdk" src={`https://ecpg${checkout.environment === 'stage' ? '-stage' : ''}.ecpay.com.tw/Scripts/sdk-1.0.0.js`} onReady={() => setSdkReady(true)} onError={() => setError(copy.paymentLoadFailed)}/>}
    {expired && !submitted && <p className="preorder-error" role="alert">{copy.paymentExpired}</p>}
    {error && <p className="preorder-error" role="alert">{error}</p>}
    {!ready && error && sdkReady && <button type="button" className="text-link" onClick={() => { setReady(false); setError(''); setRetry(value => value + 1); }}>{copy.retry}</button>}
    <div className="preorder-totals"><div><span>{copy.subtotal} × {summary.quantity}</span><span>{money(summary.subtotal)}</span></div><div><span>{copy.shipping}</span><span>{money(summary.shippingFee)}</span></div><div className="preorder-total"><strong>{copy.total}</strong><strong>{money(summary.total)}</strong></div></div>
    <button type="button" className="preorder-button preorder-submit" onClick={pay} disabled={!ready || busy || expired || submitted}>{busy ? copy.processingPayment : `${copy.payNow} ${money(summary.total)}`}{busy ? <LoaderCircle size={18} className="preorder-spinner"/> : <ArrowUpRight size={18}/>}</button>
    {submitted && !busy && <a className="text-link" href={resultUrl}>{copy.viewConfirmation}<ArrowUpRight size={16}/></a>}
    <p className="preorder-privacy"><LockKeyhole size={13}/>{copy.embeddedPrivacy}</p>
  </div>;
}
