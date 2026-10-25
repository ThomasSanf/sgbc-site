# SGBC store admin setup

The admin runs at `/admin/`. Google is the only sign-in provider. There is no public registration, password login, default password, or development login bypass.

The store has product editing, inventory adjustments, unpaid reservation tracking, Stripe checkout links, payment reconciliation, fulfillment tracking, refunds synchronized from Stripe, and an activity log. Prices are stored as integer minor units. Inventory changes and payment processing are transactional.

The public landing page keeps its existing coming-soon notice. Reservations and checkout start closed. The backend exposes APIs for a future storefront; opening a backend setting does not change that landing-page notice.

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
- Optional Stripe keys from the next section

No secret uses a `NEXT_PUBLIC_` variable. Do not share auth secrets or databases with untrusted preview deployments. A different preview origin requires its own matching OAuth callback and environment configuration.

Production cookies are Secure, HttpOnly, SameSite=Lax, and backed by database sessions. Every private page/API validates the session and allowlist; mutations additionally check the exact Origin. Admin responses are not cached. Public write endpoints have database-backed request limits and bounded JSON bodies. Vercel's trusted `x-real-ip` supplies the rate-limit identity. On another host, the reverse proxy must overwrite that header and the origin should be reachable only through that proxy.

## 5. Stripe (start in test mode)

Create a Stripe account and use test-mode keys first. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the environment, then restart/redeploy. Do not enter them in the dashboard or chat.

Register a webhook at:

```text
https://sgbc-site.vercel.app/api/webhooks/stripe/
```

Select snapshot events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `charge.refunded`

For local testing, use the [Stripe CLI](https://docs.stripe.com/stripe-cli):

```text
stripe listen --forward-to http://127.0.0.1:3000/api/webhooks/stripe/
```

Use the signing secret returned by that listener locally. The published endpoint has its own signing secret. The signature is checked against the raw request body before events are processed. Checkout completion is verified against Stripe; browser redirects cannot mark orders paid. Repeated events are idempotent and a paid amount/currency must match the order snapshot.

Set a real product price, activate the product, add inventory, then enable checkout in Settings. In Orders, create a checkout link with customer name, email, product, and quantity. Copy and share that link yourself; the app does not send customer messages. Card payments and **Taiwan shipping addresses** are supported in this first version. Shipping is included in the product price; separate shipping rates, tax calculation, other shipping countries, discounts, and multi-item carts are not implemented. Configure your price and sales terms accordingly before enabling live payments.

A checkout holds inventory for one hour. Successful payment consumes the hold; an expired session releases it. Fulfillment requires confirmed payment and a tracking number. Refunds are initiated in the Stripe dashboard; their webhook updates the order and net sales. Refunded stock is not automatically returned—adjust stock after receiving the return.

Use **Check payment status** on an order to reconcile missing webhook delivery. Stripe retries failed webhooks. A network failure during checkout creation keeps the stock hold because a payable session might exist. Retry the identical checkout request (same request key) within 23 hours. If no Stripe session ID was saved and the request cannot be retried, locate the order UUID in Stripe's `sgbc_order_id` metadata before resolving the hold manually. Never release a hold just because a request timed out. No automatic scheduled reconciliation is configured.

API references: [Stripe webhooks](https://docs.stripe.com/webhooks), [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create).

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
| `POST /api/admin/reconcile/` | Retrieve current Stripe payment status | Approved admin + same origin |
| `PATCH /api/admin/settings/` | Open/close backend reservations or checkout | Approved admin + same origin |
| `GET /api/store/catalog/` | Active catalog and availability flags | Public |
| `POST /api/store/preorders/` | Unpaid reservation request | Open store + same origin + rate limit |
| `POST /api/store/checkout/` | Checkout URL | Open store + same origin + rate limit |
| `POST /api/webhooks/stripe/` | Payment/refund updates | Valid Stripe signature |

Public reservation body: `{ productId, name, email, quantity }`. Checkout adds `requestKey`, a UUID created once per attempt and reused when retrying. Prices are always read from the database, never accepted from a customer. A reservation is not a paid order and does not reserve stock.

## Checks

`pnpm test` exercises authorization, exact email matching, CSRF, session expiry/revocation, protected OAuth state cookies, closed registration, webhook signatures, stock holds, duplicate events, price tampering, optimistic locking, fulfillment, refunds, and audit records against disposable databases. No real Google/Stripe account is used in these tests.

`pnpm build` checks TypeScript and builds the Next.js server. `pnpm audit --prod` checks runtime dependency advisories. Real Google login and Stripe test checkout/webhook delivery still require the credentials above; complete those end-to-end checks before live deployment.
