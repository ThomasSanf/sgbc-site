# ECPay paid preorders

The storefront uses ECPay All-in-One hosted **one-time credit-card payment**. ATM,
bank transfer, installments and card binding are not enabled. Customers enter card
details on ECPay; SGBC stores only the order, delivery details and payment references.
Both English and Taiwan Traditional Chinese are supported.

The intended launch is **200 consoles at NT$5,500 each**, with Taiwan delivery charged
per console. NT$80 is only a test shipping rate until the owner confirms it. There
is no estimated shipping date; the checkout requires acknowledgment of that fact.
New databases still seed an unpriced draft product, not automatically open sales.

## Configuration

Set server-only environment variables; never use `NEXT_PUBLIC_`, commit secrets,
or paste credentials into chat:

```dotenv
PAYMENT_PROVIDER=ecpay
ECPAY_ENVIRONMENT=live
ECPAY_MERCHANT_ID=your-merchant-id
ECPAY_HASH_KEY=your-hash-key
ECPAY_HASH_IV=your-hash-iv
BETTER_AUTH_URL=https://sgbc-site.vercel.app
```

Keep the existing Google authentication and database variables. Run `pnpm db:migrate`
against the target database before deploying. Migration 0001 retains existing Stripe
orders and adds ECPay references, environment tags and separate shipping amounts.

The application sends these URLs with every order; do not interchange them:

| URL | Purpose |
| --- | --- |
| `/api/webhooks/ecpay/` | Public server-to-server payment notification (`ReturnURL`) |
| `/api/store/ecpay-return/` | Browser POST return (`OrderResultURL`), never changes payment state |
| `/checkout/result/` | Customer return page, never claims payment from URL parameters |

Use the exact public HTTPS origin in `BETTER_AUTH_URL`. ECPay must be able to POST
to the webhook without a login, deployment-protection page, or redirect. Trailing
slashes are included in the submitted URLs to match this Next.js deployment.

## Sandbox first

Use a **separate database and local/preview deployment**. Never share production
inventory or customer data with the sandbox. Vercel production explicitly refuses
stage checkout. Live mode also rejects the known public test merchant credentials.

ECPay publishes these sandbox credentials:

```dotenv
ECPAY_ENVIRONMENT=stage
ECPAY_MERCHANT_ID=3002607
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
ECPAY_HASH_IV=EkRm7iFT261dpevs
```

Use the [current official test cards](https://developers.ecpay.com.tw/2856/), never
a real card. Set the sandbox product to NT$5,500, allocate 200 test units, enter
NT$80 delivery per console in Admin → Settings, and enable checkout. The dialog
must show its sandbox notice. Two consoles should total NT$11,160.

Localhost cannot receive ECPay's server callback. After a real sandbox card test,
Admin → Orders → Check payment status queries ECPay and applies the same verified
transition. To test actual network callback delivery, use a publicly reachable
HTTPS preview with its own database and matching authentication configuration.
The merchant dashboard's simulated callback (`SimulatePaid=1`) is deliberately
ignored: it cannot create a paid order, even with valid signatures.

## Open live checkout

1. Complete ECPay merchant approval and obtain the live AIO MerchantID, HashKey and
   HashIV. Confirm that credit-card acceptance and the required preorder volume are
   approved for this merchant.
2. Add the live server variables to the existing Vercel project's Production
   environment and redeploy. Keep the store closed during setup.
3. Verify the product is TWD, active, priced NT$5,500, and its allocation is correct.
   Admin prices and delivery fields use whole NT dollars; storage uses minor units
   (NT$5,500 = 550000).
4. Confirm the final delivery charge and save it in Admin → Settings. A blank fee
   means unconfirmed and blocks checkout; zero explicitly means free shipping.
5. Complete the merchant's live payment/callback check, then enable paid checkout.
   Unpaid reservations remain separately controlled and are not the storefront flow.

## Payment and stock handling

- The server loads prices and shipping, checks the displayed expected total, and
  atomically holds available units before issuing a signed ECPay form.
- Retries of the same request reuse the same order and merchant trade number.
  Never create a second checkout to resolve an uncertain payment.
- Notifications require the correct merchant, SHA-256 checksum, trade reference,
  amount and credit-card method. Successful notifications are checked against a
  fresh signed ECPay query before stock is consumed and the order becomes paid.
- Duplicate and out-of-order messages cannot consume stock twice. `1|OK` is returned
  only after database persistence. Provider/network failures keep the hold so a
  retry can safely reconcile the order.
- Sandbox payments are excluded from net sales and paid-order metrics. They cannot
  be fulfilled. Production and sandbox databases must still remain separate.
- Fulfillment requires confirmed live payment and a tracking number.

## Operational limits

**Unpaid ECPay holds do not automatically expire.** A failed card attempt, closing
the browser, or an unpaid query does not prove that an issued hosted checkout can
never be paid. Check payment status in Admin. Abandoned trades need confirmation
from ECPay that they are unpayable before an operator performs an audited database
hold release; this version intentionally has no unsafe "release now" button.
Monitor pending holds before opening a limited batch.

ECPay refunds are handled in the ECPay merchant dashboard. This version does **not**
automatically issue or synchronize ECPay refunds, disputes or settlement balances;
its sales metrics should not be used as settlement accounting. Record and reconcile
those adjustments operationally before relying on the dashboard totals. The legacy
Stripe webhook remains available for pre-existing Stripe orders.

There is no automatic customer email, public order lookup, shipping-label service,
tax/invoice calculation, recurring reconciliation job, international shipping,
discount code, or multi-product cart. The return page says payment is being confirmed
and does not promise an email.

## Verification

`pnpm test` covers the official checksum vector, forged messages, price tampering,
checkout gating, duplicate callbacks, stock allocation, migration compatibility,
browser-return safety and sandbox isolation, as well as existing admin security.
These tests mock provider queries. A real sandbox checkout and a public callback
delivery check are separate integration checks. `pnpm build` checks TypeScript and
builds the production application.

Official references: [checkout fields](https://developers.ecpay.com.tw/2866/),
[checksums](https://developers.ecpay.com.tw/2902/),
[notifications](https://developers.ecpay.com.tw/2878/),
[order queries](https://developers.ecpay.com.tw/2890/).
