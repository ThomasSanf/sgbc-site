import Link from 'next/link';
import { publicSandboxMode } from '@/lib/server/sandbox';
export default async function CheckoutResult({ searchParams }: { searchParams: Promise<{ result?: string; locale?: string }> }) {
  const params = await searchParams, zh = params.locale === 'zh-TW';
  const returned = ['cancelled', 'returned', 'unverified'].includes(params.result ?? '');
  const sandbox = publicSandboxMode();
  return <main style={{ maxWidth: 620, margin: '15vh auto', padding: 28 }}>
    <p className="mono">SGBC / CHECKOUT</p>
    {sandbox && <p className="preorder-sandbox">{zh ? '測試結帳 · 不會實際扣款或出貨。測試付款結果可於管理後台查看。' : 'Test checkout · No real payment or shipment. Test payment status is available in the admin dashboard.'}</p>}
    <h1 style={{ fontSize: 48, margin: '28px 0' }}>{zh ? returned ? '返回商店。' : '正在確認付款。' : returned ? 'Back to the store.' : 'Confirming your payment.'}</h1>
    <p style={{ lineHeight: 1.7, color: 'var(--muted)' }}>{zh ? '訂單以金流服務商確認的付款結果為準。返回此頁面不代表付款成功，也不會取消已完成的付款。若已刷卡，請勿立即重新下單。' : 'Your order is confirmed only after verification with the payment provider. Returning to this page does not confirm or cancel a payment. If you already paid, please do not place another order immediately.'}</p>
    <p style={{ lineHeight: 1.7, margin: '20px 0', color: 'var(--muted)' }}>{zh ? '本商品為預購商品，目前尚未公布預計出貨日期。' : 'This is a preorder. An estimated shipping date has not been announced.'}</p>
    <Link className="text-link" href="/">{zh ? '返回 SGBC' : 'Return to SGBC'} →</Link>
  </main>;
}
