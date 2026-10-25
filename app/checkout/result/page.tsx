import Link from 'next/link';
export default async function CheckoutResult({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const cancelled = (await searchParams).result === 'cancelled';
  return <main style={{ maxWidth: 620, margin: '15vh auto', padding: 28 }}>
    <p className="mono">SGBC / CHECKOUT</p>
    <h1 style={{ fontSize: 48, margin: '28px 0' }}>{cancelled ? 'Back to the store.' : 'Thank you.'}</h1>
    <p style={{ lineHeight: 1.7, color: 'var(--muted)' }}>{cancelled ? 'You left checkout. An unpaid checkout expires automatically; returning here does not cancel a payment already completed.' : 'Your payment is being confirmed by our payment provider. Your order will appear in our system once confirmation arrives.'}</p>
    <Link className="text-link" href="/">Return to SGBC →</Link>
  </main>;
}
