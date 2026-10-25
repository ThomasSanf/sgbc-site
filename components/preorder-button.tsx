'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, ChevronRight, LoaderCircle, LockKeyhole, X } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { siteCopy, type Locale } from '@/lib/site-copy';
import type { CheckoutDestination, EmbeddedCheckout, StorefrontCatalog } from '@/lib/storefront-types';
import { EmbeddedPayment } from '@/components/embedded-payment';
import { taiwanCities, taiwanCity, taiwanDistrict, upcomingDeliveryCountries } from '@/lib/shipping';
import { salesPolicy } from '@/lib/sales-policy';
import { SALES_POLICY_VERSION } from '@/lib/sales-policy-version';
import { SalesPolicyContent } from '@/components/sales-policy-content';

export function PreorderButton({ className = '', locale }: { className?: string; locale: Locale }) {
  const copy = siteCopy[locale].preorder;
  const policy = salesPolicy[locale];
  const id = useId();
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<StorefrontCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [payment, setPayment] = useState<(EmbeddedCheckout & { requestKey: string }) | null>(null);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const product = catalog?.products.find(item => item.currency === 'TWD' && item.price > 0);
  const available = Math.max(0, Math.min(5, product?.available ?? 0));
  const selectedQuantity = Math.max(1, Math.min(quantity, available));
  const selectedCity = taiwanCity(city);
  const deliveryRate = catalog?.shippingFeePerUnit ?? null;
  const shippingFee = (deliveryRate ?? 0) * selectedQuantity;
  const ready = Boolean(catalog?.checkoutOpen && product && available > 0 && typeof catalog.shippingFeePerUnit === 'number');
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'TWD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value / 100);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    fetch('/api/store/catalog/', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Catalog unavailable');
        const data: StorefrontCatalog = await response.json();
        setCatalog(data);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, reload]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready || !product || deliveryRate === null) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    if (form.get('policyAccepted') !== 'on') { setError(policy.required); return; }
    const payload = {
      productId: product.id, name: value('name'), email: value('email'), quantity: selectedQuantity,
      locale, expectedTotal: product.price * selectedQuantity + shippingFee, acknowledged: form.get('acknowledged') === 'on',
      policyAccepted: true, policyVersion: SALES_POLICY_VERSION,
      shipping: { phone: value('phone'), postalCode, city, district, address: value('address'), country: 'TW' },
    };
    setBusy(true);
    setError('');
    try {
      // Keep retries tied to one checkout without storing customer details in browser storage.
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`embedded-v1:${JSON.stringify(payload)}`));
      const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (attempt.current?.fingerprint !== fingerprint) {
        let previous: { fingerprint?: string; key?: string; created?: number } | null = null;
        try { previous = JSON.parse(sessionStorage.getItem('sgbc-checkout-attempt') ?? 'null'); } catch { /* Storage is optional. */ }
        const key = previous?.fingerprint === fingerprint && typeof previous.key === 'string' && /^[0-9a-f-]{36}$/i.test(previous.key) && Date.now() - (previous.created ?? 0) < 23 * 60 * 60 * 1000 ? previous.key : crypto.randomUUID();
        attempt.current = { fingerprint, key };
        try { sessionStorage.setItem('sgbc-checkout-attempt', JSON.stringify({ ...attempt.current, created: Date.now() })); } catch { /* In-memory retries remain available. */ }
      }
      const response = await fetch('/api/store/checkout/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestKey: attempt.current.key }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? copy.rateLimited : response.status === 409 ? copy.changed : response.status === 400 ? copy.invalid : copy.failed);
        if (response.status === 409) setReload(value => value + 1);
        return;
      }
      const destination: CheckoutDestination = await response.json();
      if (destination.provider === 'ecpay-embedded') { setPayment({ ...destination, requestKey: attempt.current.key }); return; }
      const url = new URL(destination.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Invalid payment destination');
      if (destination.provider === 'ecpay') {
        if (!['payment.ecpay.com.tw', 'payment-stage.ecpay.com.tw'].includes(url.hostname) || url.pathname !== '/Cashier/AioCheckOut/V5') throw new Error('Invalid payment destination');
        const paymentForm = document.createElement('form');
        paymentForm.method = 'POST';
        paymentForm.action = url.href;
        for (const [name, value] of Object.entries(destination.fields)) {
          const input = document.createElement('input');
          input.type = 'hidden'; input.name = name; input.value = value;
          paymentForm.append(input);
        }
        document.body.append(paymentForm);
        paymentForm.submit();
      } else {
        if (destination.provider !== 'stripe' || url.hostname !== 'checkout.stripe.com') throw new Error('Invalid payment destination');
        window.location.assign(url.href);
      }
    } catch { setError(copy.failed); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy) { if (value) { setError(''); if (!payment) setPolicyAccepted(false); } setOpen(value); } }}>
    <DialogTrigger className={`preorder-button ${className}`}>{copy.button} <ArrowUpRight size={18} aria-hidden="true"/></DialogTrigger>
    <DialogContent className={`preorder-dialog${payment ? ' preorder-payment-dialog' : ''}`} showCloseButton={false}>
      <div className="preorder-top"><span className="mono preorder-eyebrow"><span className="status-dot"/> {copy.eyebrow}</span><DialogClose className="preorder-close" aria-label={copy.close} disabled={busy}><X size={20}/></DialogClose></div>
      <div><DialogTitle className="preorder-title">{copy.title}<br/>{copy.subtitle}</DialogTitle><DialogDescription className="preorder-description">{copy.description}</DialogDescription></div>
      <div className="preorder-product"><div><strong>{product?.name ?? 'SGBC Console · Rev C'}</strong><span>{copy.finish}</span></div><div><strong>{money(product?.price ?? 550000)}</strong><span>{copy.perUnit}</span></div></div>
      <p className="preorder-delivery"><span className="status-dot"/>{copy.shippingDate}</p>
      {catalog?.sandbox && !payment && <div className="preorder-sandbox" role="status"><strong>{copy.sandbox}</strong><span>{copy.testCard}</span><code>4311 9522 2222 2222</code><span>{copy.testDetails}</span></div>}
      <div hidden={Boolean(payment)}>
      {loading ? <p className="preorder-status" role="status"><LoaderCircle size={18} className="preorder-spinner"/>{copy.loading}</p> : loadFailed ? <div className="preorder-status" role="alert"><p>{copy.loadFailed}</p><button className="text-link" onClick={() => setReload(value => value + 1)}>{copy.retry} <ArrowUpRight size={16}/></button></div> : !ready ? <div className="preorder-status" role="status"><strong>{catalog?.checkoutOpen && product && available === 0 ? copy.soldOut : copy.closedTitle}</strong><p>{copy.closedDescription}</p></div> : <form className="preorder-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label htmlFor={`${id}-name`}>{copy.name}<input id={`${id}-name`} name="name" autoComplete="name" required maxLength={120}/></label>
          <label htmlFor={`${id}-email`}>{copy.email}<input id={`${id}-email`} name="email" type="email" autoComplete="email" required maxLength={254}/></label>
          <div className="preorder-fields"><label htmlFor={`${id}-phone`}>{copy.phone}<input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" required minLength={8} maxLength={24}/></label><label htmlFor={`${id}-quantity`}>{copy.quantity}<select id={`${id}-quantity`} name="quantity" value={selectedQuantity} onChange={event => setQuantity(Number(event.target.value))}>{Array.from({ length: available }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label></div>
          <label htmlFor={`${id}-country`}>{copy.country}<select id={`${id}-country`} name="country" autoComplete="country" defaultValue="TW"><option value="TW">{copy.countries.TW}</option>{upcomingDeliveryCountries.map(code => <option key={code} value={code} disabled>{copy.countries[code]}</option>)}</select></label>
          <div className="preorder-fields preorder-address-fields"><label htmlFor={`${id}-city`}>{copy.city}<select id={`${id}-city`} name="city" autoComplete="address-level1" required value={city} onChange={event => { setCity(event.target.value); setDistrict(''); setPostalCode(''); setError(''); }}><option value="" disabled>{copy.selectCity}</option>{taiwanCities.map(item => <option key={item.name} value={item.name}>{locale === 'zh-TW' ? item.name : item.english}</option>)}</select></label><label htmlFor={`${id}-district`}>{copy.district}<select id={`${id}-district`} name="district" autoComplete="address-level2" required disabled={!selectedCity} value={district} onChange={event => { setDistrict(event.target.value); setPostalCode(taiwanDistrict(city, event.target.value)?.postalCode ?? ''); setError(''); }}><option value="" disabled>{copy.selectDistrict}</option>{selectedCity?.districts.map(item => <option key={item.name} value={item.name}>{locale === 'zh-TW' ? item.name : item.english}</option>)}</select></label></div>
          <label htmlFor={`${id}-postal`}>{copy.postalCode}<input id={`${id}-postal`} name="postalCode" inputMode="numeric" autoComplete="postal-code" required value={postalCode} onChange={event => setPostalCode(event.target.value)} pattern="[0-9]{3}([0-9]{2,3})?" maxLength={6}/></label>
          <label htmlFor={`${id}-address`}>{copy.address}<input id={`${id}-address`} name="address" autoComplete="street-address" required minLength={5} maxLength={240}/></label>
          <div className="preorder-totals"><div><span>{copy.subtotal}</span><span>{money(product!.price * selectedQuantity)}</span></div><div><span>{copy.shipping}</span><span>{deliveryRate === null ? '—' : money(shippingFee)}</span></div><div className="preorder-total"><strong>{copy.total}</strong><strong>{deliveryRate === null ? '—' : money(product!.price * selectedQuantity + shippingFee)}</strong></div></div>
          <label className="preorder-acknowledgement"><input name="acknowledged" type="checkbox" required/>{copy.acknowledgement}</label>
          <details className="preorder-policy">
            <summary className="disclosure-summary"><ChevronRight size={16} aria-hidden="true"/>{policy.read}</summary>
            <div className="preorder-policy-body"><p className="sales-policy-date">{policy.updated}</p><SalesPolicyContent locale={locale} heading="h3"/><a href={`/sales-policy/${locale}/`} target="_blank" rel="noopener noreferrer">{policy.full}<ArrowUpRight size={16} aria-hidden="true"/></a></div>
          </details>
          <label className="preorder-acknowledgement"><input name="policyAccepted" type="checkbox" required checked={policyAccepted} onChange={event => setPolicyAccepted(event.target.checked)}/>{policy.accept}</label>
          {error && <p className="preorder-error" role="alert">{error}</p>}
          <button className="preorder-button preorder-submit" type="submit" disabled={deliveryRate === null || !policyAccepted}>{busy ? copy.connecting : copy.pay} {busy ? <LoaderCircle size={18} className="preorder-spinner"/> : <ArrowUpRight size={18}/>}</button>
          <p className="preorder-privacy"><LockKeyhole size={13}/>{copy.privacy}</p>
        </fieldset>
      </form>}
      </div>
      {payment && <EmbeddedPayment key={`${payment.token}:${locale}`} checkout={payment} requestKey={payment.requestKey} locale={locale} onBusy={setBusy} onEdit={() => {
        setPayment(null); attempt.current = null; setError(''); setPolicyAccepted(false);
        try { sessionStorage.removeItem('sgbc-checkout-attempt'); } catch { /* Storage is optional. */ }
      }}/>}
    </DialogContent>
  </Dialog>;
}
