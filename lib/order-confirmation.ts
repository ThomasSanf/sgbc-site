import type { Locale } from './site-copy';

export type OrderConfirmation = {
  id: string; reference: string; productName: string; sku: string; quantity: number;
  unitPrice: number; subtotal: number; shippingFee: number; total: number; currency: string;
  name: string; email: string; createdAt: number; updatedAt: number; locale: Locale;
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded' | 'partially_refunded';
  sandbox: boolean; provider: 'ecpay' | 'stripe'; paymentReference: string | null;
  refundedAmount: number; trackingNumber: string;
  shipping: { phone: string; postalCode: string; city: string; district: string; address: string; country: string } | null;
};
export const confirmationCopy = {
  en: {
    eyebrow: 'SGBC / YOUR ORDER', title: 'A new home.\nA few steps closer.',
    paid: 'Payment confirmed', fulfilled: 'Order shipped', pending: 'Confirming your payment', cancelled: 'Order cancelled', refunded: 'Payment refunded', partially_refunded: 'Payment partially refunded',
    paidBody: 'Thank you. Your payment has been verified and your pre-order is confirmed.',
    pendingBody: 'We are checking your payment with the provider. If you already paid, please do not place another order.',
    cancelledBody: 'This order is cancelled. It is not a payment confirmation.',
    refundedBody: 'The latest payment status and refund amount are shown below.',
    sandbox: 'TEST ORDER - No real payment or shipment.', sandboxPaid: 'Your test payment has been verified. This is a sandbox order only.',
    order: 'Order number', date: 'Ordered on', payment: 'Payment', reference: 'Payment reference',
    product: 'Your console', quantity: 'Quantity', unitPrice: 'Unit price', subtotal: 'Subtotal', shippingFee: 'Delivery', total: 'Order total', refund: 'Refunded',
    customer: 'Customer', delivery: 'Deliver to', tracking: 'Tracking number', method: 'Credit card',
    preorder: 'This is a pre-order. An estimated shipping date has not been announced.',
    download: 'Save order details as PDF', downloading: 'Preparing PDF…', downloadError: 'The PDF could not be downloaded. Please try again.',
    refresh: 'Check payment status', checking: 'Checking…', checkError: 'We could not refresh the payment status. Your order is unchanged. Please try again shortly.',
    waiting: 'Confirmation is taking longer than usual. Check again shortly; please do not pay again.',
    home: 'Back to SGBC', policy: 'Sales policy', private: 'Keep this page private. Anyone with this link can view these order details. The link is available for 180 days from the order date.',
    unavailable: 'Order confirmation unavailable.', unavailableBody: 'Open the private confirmation link from your checkout. A missing, invalid or expired link cannot show order details. If you already paid, please contact the store with your payment reference before ordering again.',
    document: 'Order confirmation', notInvoice: 'Order record only. This document is not a tax invoice.', generated: 'Generated', status: 'Status', taiwan: 'Taiwan', noAddress: 'Delivery details are not available yet.',
  },
  'zh-TW': {
    eyebrow: 'SGBC / 你的訂單', title: '經典的新歸宿，\n又近了一步。',
    paid: '付款已確認', fulfilled: '訂單已出貨', pending: '正在確認付款', cancelled: '訂單已取消', refunded: '款項已退還', partially_refunded: '款項已部分退還',
    paidBody: '感謝你的支持。付款已確認，你的預購訂單已成立。',
    pendingBody: '我們正在向金流服務商確認付款。如果你已完成付款，請勿再次下單或付款。',
    cancelledBody: '此訂單已取消，不代表付款成功。', refundedBody: '以下顯示最新付款狀態及退款金額。',
    sandbox: '測試訂單 - 不會實際扣款或出貨。', sandboxPaid: '測試付款已確認。此訂單僅供測試，不會實際扣款或出貨。',
    order: '訂單編號', date: '訂購時間', payment: '付款方式', reference: '金流交易編號',
    product: '你的主機', quantity: '數量', unitPrice: '單價', subtotal: '商品小計', shippingFee: '運費', total: '訂單總額', refund: '已退款金額',
    customer: '訂購人', delivery: '收件資訊', tracking: '物流追蹤編號', method: '信用卡',
    preorder: '本商品為預購商品，目前尚未公布預計出貨日期。',
    download: '儲存訂單明細 PDF', downloading: '正在產生 PDF…', downloadError: '無法下載 PDF，請稍後再試。',
    refresh: '查詢付款狀態', checking: '查詢中…', checkError: '暫時無法更新付款狀態，訂單並未變更，請稍後再試。',
    waiting: '付款確認時間較長，請稍後再次查詢，請勿重複付款。',
    home: '返回 SGBC', policy: '銷售政策', private: '請妥善保管此頁面連結。持有連結的人可查看訂單明細，連結自訂購日起 180 天內有效。',
    unavailable: '無法顯示訂單確認。', unavailableBody: '請使用結帳時提供的私人訂單確認連結。連結遺失、無效或已過期時，無法顯示訂單資料。如果已付款，請先提供金流交易編號聯絡商店，切勿重複下單。',
    document: '訂單確認', notInvoice: '本文件僅供訂單紀錄使用，並非統一發票。', generated: '產生時間', status: '狀態', taiwan: '台灣', noAddress: '目前尚無收件資訊。',
  },
};
export function orderMoney(value: number, currency: string, locale: Locale) {
  return `${currency} ${new Intl.NumberFormat(locale, { minimumFractionDigits: currency === 'TWD' ? 0 : 2, maximumFractionDigits: currency === 'TWD' ? 0 : 2 }).format(value / 100)}`;
}
export function orderDate(value: number, locale: Locale) {
  // Explicit formatting keeps server and browser output identical across ICU versions.
  const taipei = new Date(value + 8 * 60 * 60 * 1000).toISOString();
  const day = locale === 'zh-TW' ? taipei.slice(0, 10).replaceAll('-', '/') : taipei.slice(0, 10);
  return `${day} ${taipei.slice(11, 16)} (UTC+8)`;
}
