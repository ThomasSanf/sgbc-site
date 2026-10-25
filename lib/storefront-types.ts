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
  | { provider: 'stripe'; url: string; orderId: string }
  | { provider: 'ecpay'; url: string; fields: Record<string, string>; orderId: string };
