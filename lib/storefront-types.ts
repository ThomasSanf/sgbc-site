export type StorefrontProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  available: number;
};

export type StorefrontCatalog = {
  products: StorefrontProduct[];
  checkoutOpen: boolean;
  shippingFeePerUnit: number | null;
  sandbox: boolean;
};

export type CheckoutDestination =
  | EmbeddedCheckout
  | { provider: 'stripe'; url: string; orderId: string }
  | { provider: 'ecpay'; url: string; fields: Record<string, string>; orderId: string };

export type EmbeddedCheckout = {
  provider: 'ecpay-embedded'; orderId: string; confirmationUrl: string; merchantTradeNo: string; token: string;
  environment: 'stage' | 'live'; expiresAt: number;
  summary: { name: string; email: string; quantity: number; subtotal: number; shippingFee: number; total: number;
    address: { phone: string; country: string; city: string; district: string; postalCode: string; address: string } };
};
