'use client';

import { useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, LoaderCircle, X } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { wishlistCopy } from '@/lib/wishlist-copy';
import type { Locale } from '@/lib/site-copy';

export function WishlistButton({ className = '', locale }: { className?: string; locale: Locale }) {
  const copy = wishlistCopy[locale], id = useId();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) setError(''); }}>
    <DialogTrigger className={`preorder-button ${className}`}>{copy.button}<ArrowUpRight size={18} aria-hidden="true"/></DialogTrigger>
    <DialogContent className="preorder-dialog wishlist-dialog" showCloseButton={false}>
      <div className="preorder-top"><span className="mono preorder-eyebrow"><span className="status-dot"/>{copy.eyebrow}</span><DialogClose className="preorder-close" aria-label={copy.close}><X size={22}/></DialogClose></div>
      <div><DialogTitle className="preorder-title">{copy.title}<br/>{copy.subtitle}</DialogTitle>
      <DialogDescription className="preorder-description">{copy.description}</DialogDescription></div>
      {saved ? <div className="wishlist-success" aria-live="polite"><Check size={24} aria-hidden="true"/><h3>{copy.successTitle}</h3><p>{copy.success}</p></div> : <form className="preorder-form wishlist-form" onSubmit={async event => {
        event.preventDefault();
        if (submitting.current) return;
        const email = new FormData(event.currentTarget).get('email');
        submitting.current = true; setBusy(true); setError('');
        try {
          const response = await fetch('/api/store/wishlist/', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, locale }) });
          if (!response.ok) { setError(response.status === 429 ? copy.limited : copy.error); return; }
          setSaved(true);
        } catch { setError(copy.error); }
        finally { submitting.current = false; setBusy(false); }
      }}>
        <label htmlFor={`${id}-email`}>{copy.email}<input id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} required disabled={busy}/></label>
        <p className="wishlist-privacy">{copy.privacy}</p>
        {error && <p className="preorder-error" role="alert">{error}</p>}
        <button className="preorder-button preorder-submit" type="submit" disabled={busy}>{busy ? copy.submitting : copy.submit}{busy ? <LoaderCircle size={18} className="preorder-spinner" aria-hidden="true"/> : <ArrowUpRight size={18} aria-hidden="true"/>}</button>
      </form>}
    </DialogContent>
  </Dialog>;
}
