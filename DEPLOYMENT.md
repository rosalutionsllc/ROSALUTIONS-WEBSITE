# Deploy to Cloudflare from Windows PowerShell

Nothing has been published by this project setup. Complete these steps when you are ready to launch. No personal computer needs to stay on after successful deployment.

## 1. Prepare and test locally

Install Node.js 24 LTS from https://nodejs.org/ and Git from https://git-scm.com/. Reopen PowerShell after installation. In the project folder:

```powershell
npm ci
npm run setup:local
npm run db:migrate
npm run dev
```

The migration command explicitly uses `--local`. It never touches the production database. In a second PowerShell terminal:

```powershell
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

The tests use a local instance and preview email. Stop a local dev server with Ctrl+C.

## 2. Confirm business details before publishing

Confirm that **(813) 898-4392** is the business phone number. Set `BUSINESS_PHONE` in `wrangler.jsonc` accordingly. Confirm the business inbox, service availability, $0.21 rates, $150 visit minimum, and tax treatment. Complete the privacy/terms templates, including effective dates, retention policy, cancellation/payment terms and any required legal details.

Add your official logo if ready. Do not invent claims or substitute fake project photos. Review mobile and desktop pages. No appointment is automatically booked by the calculator.

## 3. Log in and create your D1 database

Create a Cloudflare account, then:

```powershell
npx wrangler login
npx wrangler whoami
npx wrangler d1 create rosalutions
```

Cloudflare prints a real `database_id`. Open the configuration:

```powershell
notepad wrangler.jsonc
```

Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with that exact ID. Keep `binding` as `DB`, `database_name` as `rosalutions`, and `migrations_dir` as `migrations`. Do not paste IDs from examples or another project. `APP_ENV` must remain `production` in this file. `.dev.vars` only configures local execution and is not a production secret upload mechanism.

Choose the free workers.dev account subdomain in Cloudflare Workers & Pages settings. The Worker name is `rosalutions-website`, so its expected URL is `https://rosalutions-website.YOUR-ACCOUNT-SUBDOMAIN.workers.dev`. Obtain the actual subdomain from your account; do not invent one. Set `APP_URL` to the exact HTTPS origin with no path. A custom domain can replace this later by changing routing and settings without changing application code.

Before the remote migration, verify you are logged into the intended account and the configured database ID matches the newly created database:

```powershell
npx wrangler d1 list
npx wrangler d1 info rosalutions
npm run db:migrate:remote
```

`db:migrate:remote` explicitly applies the checked-in SQL to the configured remote `DB`. Review every future migration before running it against customer data; use Cloudflare backups/Time Travel as appropriate.

## 4. Set up Google Maps

In Google Cloud Console, create/select a project, link billing and set budget alerts/quotas. Enable:

1. **Maps JavaScript API** for satellite maps and the Geometry library.
2. **Places API (New)** for the supported PlaceAutocompleteElement.
3. **Geocoding API** for independent server validation of the selected place ID.

Create two separate keys:

- Browser key: HTTP referrer restrictions for your exact production domain and local development addresses if needed. API restrictions: Maps JavaScript API and Places API (New). Set `GOOGLE_MAPS_API_KEY` as a Cloudflare Worker variable (it is intentionally exposed to the browser). Local development uses the same named `.dev.vars` entry, preferably with a separate development key.
- Server key: API restriction to Geocoding API only. Keep it secret as `GOOGLE_MAPS_SERVER_KEY`. A browser HTTP-referrer restriction cannot be used for server requests. Cloudflare Workers do not have a dedicated fixed outbound IP by default; use API restrictions, quotas and monitoring, or an appropriate controlled-egress design if your organization needs IP restrictions.

The Geometry library requires no separate API enablement. Do not enable or use the retired Google Drawing Library. This site uses Terra Draw.

```powershell
npx wrangler secret put GOOGLE_MAPS_SERVER_KEY
```

Paste the secret only into Wrangler's secure prompt. Do not put it into public variables, `VITE_` variables, source files or chat.

Official references: https://developers.google.com/maps/documentation/javascript/place-autocomplete-new and https://developers.google.com/maps/api-security-best-practices

## 5. Configure Turnstile and owner access

Create a Cloudflare Turnstile widget for your real hostname. Set public variable `TURNSTILE_SITE_KEY`. Store its secret:

```powershell
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Production submissions fail closed without valid Turnstile settings. Local loopback development skips Turnstile only when no local secret is set.

In Cloudflare Zero Trust → Access → Applications, protect **both `/admin` (including nested paths) and `/api/admin/*`** on the same hostname. Use a Self-hosted application with an Allow policy for the owner's exact email, `rosalutionsllc@gmail.com`, or the explicitly selected owner account. Email one-time PIN is a practical identity method. Do not create an Everyone or bypass policy. Use one application/audience for both paths; otherwise the configured audience will not match the other route.

Set these Worker variables:

- `ACCESS_TEAM_DOMAIN`: your team domain, e.g. the actual `YOUR-TEAM.cloudflareaccess.com` hostname, without `https://` or a path.
- `ACCESS_AUD`: the Application Audience (AUD) tag copied from that Access application's overview.
- `ADMIN_EMAIL`: the exact authorized email address.

The Worker independently verifies the signed assertion's issuer, audience, expiry and email. Missing Access setup never enables public admin access. `LOCAL_ADMIN_TOKEN` is ignored on public hostnames/production, and must not be uploaded as a production secret.

Cloudflare's available Access integration for workers.dev and path configuration depends on account capabilities. Configure the owner paths while keeping the marketing site public, and verify the actual workers.dev hostname. Do not assume protecting a custom domain automatically protects an alternate workers.dev URL. The Worker continues denying anonymous API access on every hostname. If workers.dev path authentication is unavailable in your account, use a Cloudflare custom domain for the same Worker and configure the Access application there; do not remove the JWT checks to make login work. Disable or appropriately protect alternate public routes.

Official references: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/ and https://developers.cloudflare.com/workers/configuration/routing/workers-dev/

## 6. Configure real email

Create a Resend account. Verify a sender domain you control using the DNS records Resend supplies. Keep `rosalutionsllc@gmail.com` as the recipient business inbox; it is not a verified sender domain. Resend's test sender is generally restricted to sending to the account owner's email and is not a complete customer-email solution.

Set:

- `EMAIL_FROM`: for example `Rosalutions <quotes@YOUR-VERIFIED-DOMAIN>` using your actual verified address.
- `EMAIL_MODE`: `live` only when ready to send real notifications.
- `BUSINESS_EMAIL`: `rosalutionsllc@gmail.com` (the default).

```powershell
npx wrangler secret put RESEND_API_KEY
```

The business email sets Reply-To to the customer. The customer email sets Reply-To to the business. Both are independent outbox records, so one failure does not erase the request or the other's successful status. Owner retry actions reuse the saved email record and provider idempotency key. Requests can be managed even if email is unavailable.

Official reference: https://resend.com/docs/dashboard/domains/introduction

## 7. Configure variables and deploy

Non-secret production settings go into the `vars` object in `wrangler.jsonc` before the production build, or into your deployment's coordinated Worker configuration. Prefer keeping non-secret settings together in this file; Wrangler deployments can overwrite dashboard-managed variables. The existing `vars` include `APP_ENV`, `APP_URL`, `EMAIL_MODE` and `BUSINESS_PHONE`; add the public Maps/Turnstile keys, verified sender and Access fields described above. Keep JSON valid.

Secrets stay in Wrangler/Cloudflare secret storage. `secret put` may prompt to create the named Worker if it has not been deployed; verify the account and Worker name before accepting.

Once the phone and launch checklist are confirmed:

```powershell
npm run build
npm run deploy
```

`deploy` verifies the real database ID and HTTPS site origin, builds and runs `wrangler deploy`. It does not apply remote migrations automatically. Wrangler prints the actual workers.dev URL after success. Never claim deployment succeeded until this command succeeds and the resulting site is checked.

## 8. Verify the live site

- Public pages and custom quote fallback work on a phone and desktop.
- Real Google address search displays the correct property; draw/edit multiple services and check measurements against a known area.
- Attempt cross-service overlap and distant geometry; confirm rejection. Same-service overlaps count once.
- Turnstile accepts the real hostname and rejects expired tokens.
- Submit one clearly labeled test quote using your own contact details. Confirm the D1 record and two independent email records.
- Confirm both actual inboxes receive the expected emails, correct amounts, disclaimer and Reply-To. Provider acceptance alone does not prove delivery.
- In a private/incognito browser, `/api/admin/quotes` and other private endpoints return no customer data. Sign in as the owner and reopen the saved polygons. Verify another email cannot access them.
- Confirm notes, status changes, CSV and safe retries. Delete synthetic launch records through the dashboard.
- Review maps/API/email usage and set alerting. Choose a retention policy and periodically delete records no longer needed.

The repository is not evidence of live integration success. These steps require actual owner accounts and credentials.

## Add a custom domain later

Add a Custom Domain route to the existing Worker in Cloudflare, update `APP_URL`, Google referrer restrictions, Turnstile hostnames and Access application paths/audience as needed, and update public variables. A routine deployment applies configuration changes; no React code rewrite is needed. Update sender DNS independently if changing the email domain.

## Cost notes

Cloudflare Workers/D1/Access/Turnstile and Resend offer allowances subject to current limits. Google Maps/Places/Geocoding may charge according to usage and billing settings. A sender domain may have an annual registration cost. No Square integration or card storage is enabled. Review each provider's current prices rather than assuming all traffic is free.
