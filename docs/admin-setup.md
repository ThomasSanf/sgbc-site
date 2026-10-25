# SGBC store admin setup

The admin runs at `/admin/`. Google is the only sign-in provider. There is no public registration, password login, default password, or development login bypass.

The store has product editing, inventory adjustments, ECPay paid preorders, payment reconciliation, fulfillment tracking, and an activity log. Legacy Stripe orders and unpaid reservations remain available to admins. Prices are stored as integer minor units. Inventory changes and payment processing are transactional.

The public Preorder buttons open the bilingual checkout dialog. Checkout starts closed and opens only when ECPay is configured, a delivery rate has been confirmed, and the admin enables paid checkout. Unpaid reservations are a separate legacy feature; the storefront does not submit them.

## 1. Local configuration and database

Use Node 22.13+ and pnpm:

```powershell
pnpm install
pnpm admin:setup
pnpm db:migrate
pnpm dev
```

The setup script asks for the approved Google email, generates a random session secret, and creates `.env.local`. It does not overwrite an existing file. This file and `.data/` are ignored by Git. The current local configuration has the owner email supplied in this chat; the repository does not contain that personal email.

The local SQLite database is `.data/store.db`. Migrations create a single **draft** SGBC Rev C product with zero stock and no price. There are no fabricated sales or customers. Run `pnpm db:migrate` after pulling schema changes; use `pnpm db:generate` when changing the schema.

## 2. Google OAuth

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create or select a project, configure Google Auth Platform, and create an OAuth client with application type **Web application**.

Use only the normal identity scopes (`openid`, `email`, `profile`). While the app is in testing, add the approved admin email as a test user. Create these exact authorized redirect URIs:

```text
http://127.0.0.1:3000/api/auth/callback/google
https://sgbc-site.vercel.app/api/auth/callback/google
```

For a custom domain, add its matching callback URI too. Use the same origin consistently; `localhost` and `127.0.0.1` are different origins.

Put the client ID and secret into `.env.local`:

```dotenv
BETTER_AUTH_URL=http://127.0.0.1:3000
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
ADMIN_EMAILS=your-approved-google-email
```

Keep the generated `BETTER_AUTH_SECRET`. Restart the server and visit `/admin/login/`. The button stays disabled if required credentials are absent. Put multiple approved addresses in `ADMIN_EMAILS`, separated by commas. Full, verified email addresses must match exactly; email domains and suffixes are not accepted. Removing an address and restarting/redeploying blocks its existing sessions immediately.

Enable a passkey or two-step verification on the approved Google account. This app relies on Google's authentication and does not claim to enforce Google account MFA itself.

OAuth setup reference: [Better Auth Google provider](https://better-auth.com/docs/authentication/google).

## 3. Persistent production database

Vercel filesystem storage is not durable. Create a [Turso database](https://docs.turso.tech/quickstart), obtain its `libsql://` URL and database auth token, and set:

```dotenv
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-database-token
```

Apply the migrations to that database using these environment variables before deploying. Explicit process environment values take precedence over `.env.local`; do not overwrite your local configuration with production secrets. Run migrations once per deployment, not on each web request. Enable database backups and verify restore access in the database account.

The application refuses to use a `file:` database on Vercel. The same Drizzle schema runs locally and on hosted libSQL.

## 4. Vercel deployment

Keep the existing GitHub/Vercel project. Use the **Next.js** framework preset and `pnpm build`. Remove any custom output-directory override pointing to `out`; the site now needs Next.js functions for protected pages and APIs.

Set these server environment variables:

- `BETTER_AUTH_URL=https://sgbc-site.vercel.app` (or the final custom origin)
- `BETTER_AUTH_SECRET`: a new high-entropy value of at least 32 characters; do not reuse test fixtures
- `ADMIN_EMAILS`: the approved owner address
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL` and `DATABASE_AUTH_TOKEN`
- ECPay variables from [ECPay setup](ecpay-setup.md)

No secret uses a `NEXT_PUBLIC_` variable. Do not share auth secrets or databases with untrusted preview deployments. A different preview origin requires its own matching OAuth callback and environment configuration.

Production cookies are Secure, HttpOnly, SameSite=Lax, and backed by database sessions. Every private page/API validates the session and allowlist; mutations additionally check the exact Origin. Admin responses are not cached. Public write endpoints have database-backed request limits and bounded JSON bodies. Vercel's trusted `x-real-ip` supplies the rate-limit identity. On another host, the reverse proxy must overwrite that header and the origin should be reachable only through that proxy.

## 5. ECPay

Follow [ECPay setup](ecpay-setup.md) for the sandbox, merchant credentials, public
callbacks, shipping configuration, production activation and operational limits.
Do not open production checkout with sandbox credentials.

The storefront uses ECPay hosted credit-card checkout. Admin → Orders shows the
merchant trade number, provider reference, delivery charge and shipping details.
Use **Check payment status** to reconcile a pending payment. A confirmed live paid
order can be marked fulfilled with a tracking number. Sandbox fulfillment is blocked.

ECPay refunds and abandoned stock holds currently require operator reconciliation;
they are not automatically synchronized or expired. See the ECPay guide before launch.

### Existing Stripe orders

Stripe remains supported for existing deployments and orders. Set
`PAYMENT_PROVIDER=stripe` to use the legacy admin checkout-link workflow, alongside
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. The storefront ECPay button remains
closed in that mode. Keep `/api/webhooks/stripe/` configured for existing Stripe
orders and the events `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.expired` and
`charge.refunded`. Legacy Stripe checkout includes delivery in the product price;
the new separate-delivery setting applies to ECPay.

## API surface

| Endpoint | Purpose | Access |
| --- | --- | --- |
| `GET /api/admin/dashboard/` | Metrics, catalog, configuration | Approved admin |
| `GET /api/admin/orders/`, `/preorders/`, `/activity/` | Search and paginated records (`q`, `page`) | Approved admin |
| `POST /api/admin/products/` | Create/edit a product with version check | Approved admin + same origin |
| `POST /api/admin/inventory/` | Signed unit delta and reason | Approved admin + same origin |
| `POST/PATCH /api/admin/preorders/` | Create/manage unpaid reservations | Approved admin + same origin |
| `POST /api/admin/orders/` | Create a Stripe checkout link | Approved admin + same origin |
| `PATCH /api/admin/orders/` | Fulfill a paid order | Approved admin + same origin |
| `POST /api/admin/reconcile/` | Retrieve current ECPay/Stripe payment status | Approved admin + same origin |
| `PATCH /api/admin/settings/` | Set delivery per unit; open/close reservations or checkout | Approved admin + same origin |
| `GET /api/store/catalog/` | Active catalog and availability flags | Public |
| `POST /api/store/preorders/` | Unpaid reservation request | Open store + same origin + rate limit |
| `POST /api/store/checkout/` | Signed ECPay hosted-card form | Open store + same origin + rate limit |
| `POST /api/webhooks/ecpay/` | Verify payment and update order | ECPay checksum + server query |
| `POST /api/store/ecpay-return/` | Browser return only | Validated form, no payment mutation |
| `POST /api/webhooks/stripe/` | Payment/refund updates | Valid Stripe signature |

Public reservation body: `{ productId, name, email, quantity }`. Paid checkout additionally requires `requestKey` (a UUID reused for retries), `shipping` (`phone`, `postalCode`, `city`, `address`, `country: "TW"`), `locale` (`en` or `zh-TW`), `expectedTotal` in minor units, and `acknowledged: true`. The expected total must match the server-calculated amount. Prices and shipping are always read from the database. A reservation is not a paid order and does not reserve stock.

## Checks

`pnpm test` exercises authorization, exact email matching, CSRF, session expiry/revocation, protected OAuth state cookies, closed registration, webhook signatures, stock holds, duplicate events, price tampering, optimistic locking, fulfillment, refunds, and audit records against disposable databases. No real Google/Stripe account is used in these tests.

`pnpm build` checks TypeScript and builds the Next.js server. `pnpm audit --prod` checks runtime dependency advisories. Real provider checkout and public callback delivery require separate integration checks; complete those before enabling live checkout.
