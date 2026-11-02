# Rosalutions Pressure Washing

A functional React + TypeScript website and Hono API for Cloudflare Workers, with local D1 storage, property measurements, trusted estimates, customer requests, email outbox, and a private owner dashboard.

The application is implemented. **It has not been deployed. Real Google Maps, Resend delivery, production Turnstile and Cloudflare Access still need owner configuration and live verification.** Local email mode saves previews and never sends mail.

## Start on Windows

Install Node.js 24 LTS and Git, then open PowerShell in this repository. Node 22.12 or newer is required; Node 24 is the tested runtime.

```powershell
node --version
npm --version
npm ci
npm run setup:local
npm run db:migrate
npm run dev
```

Open the local address printed by Vite (port 5173). Keep that terminal open while developing. The published Cloudflare site will run independently of your computer.

`setup:local` creates `.dev.vars` with preview email settings and a random local owner token. It preserves an existing file. Open it with `notepad .dev.vars`, then enter its `LOCAL_ADMIN_TOKEN` value on `/admin`. This token only works on loopback addresses with `APP_ENV=local`. Never share or commit `.dev.vars`.

The website and contact workflow work without paid integrations. The map area shows a useful custom-quote fallback until a restricted browser Maps key is configured. No pretend satellite imagery or fabricated job photographs are used.

## What is implemented

- Responsive homepage, services, about, real-project gallery component, contact, quote, confirmation, privacy and terms routes.
- Supported Google PlaceAutocompleteElement, satellite Google Maps and Terra Draw polygon editing, multiple service colors, undo/redo, deletion and saved geometry.
- Live estimates without contact details. Driveway, sidewalk and patio rates come from the backend configuration.
- Server geodesic area validation, same-service union, cross-service overlap rejection, location and payload bounds, and one $150 visit minimum.
- D1 transactional quote/contact storage, unique quote numbers, duplicate-request protection and snapshotted rates.
- Two separately tracked quote emails; local previews; safe retry without a second quote; accurate unsent statuses.
- Owner-only API verified with Cloudflare Access JWT issuer, audience and owner email; independent local development token.
- Search, filters, sorting, CSV export, statuses, private notes, stored outlines, notification retries and permanent record deletion.
- Production Turnstile, rate limits, server address verification, validation, safe SQL, and security headers.
- Build-ready Workers Static Assets deployment, D1 migrations, public metadata, sitemap and robots exclusions.

## Common commands

```powershell
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Browser tests use local D1, require `.dev.vars`, and refuse production/live email mode. They create synthetic `example.test` requests and remove successful test records. Test-only API submissions do not replace live Maps verification. See [test instructions](docs/TESTING.md).

## Owner documentation

- [Cloudflare deployment — exact PowerShell steps](DEPLOYMENT.md)
- [Settings, API keys, pricing and owner controls](docs/CONFIGURATION.md)
- [Tests and live integration checklist](docs/TESTING.md)
- [File inventory](docs/FILES.md)

Default prices are $0.21/sq. ft. per service and one $150 minimum per visit. Tax defaults to zero pending owner confirmation. Special conditions and jobs over 5,000 sq. ft. request manual review. Requests never confirm an appointment.

Official logos and customer-approved before/after photos can be added later. Phone **(813) 898-4392 must be confirmed by the owner before deployment**. Privacy and terms are clearly labeled review templates.

## Architecture and limits

Vite + the Cloudflare Vite plugin run React and the Worker together. D1 is emulated locally by Wrangler and persists under ignored `.wrangler/`. The production Worker handles APIs and decorates public HTML metadata; bundled browser assets are served by Workers Static Assets. No separate server or database subscription is required.

No payment capture, automatic scheduling, public PII lookup, or roof auto-pricing is included. Pricing administration is via centralized `PRICING_JSON`, not a dashboard editor. Contact list shows the latest 100 messages; quote list pages by 100 and CSV exports at most 10,000 records. Retention is owner-controlled deletion; schedule any future automatic deletion only after choosing a retention policy.

Email status `sent` means accepted by the provider, not verified inbox delivery. Delivery/bounce webhooks are not implemented. Safe retries use the same Resend idempotency key within 23 hours of the first live attempt; older uncertain deliveries require checking the provider before manual sending.

Google Maps/Places/Geocoding may require billing. Workers, D1, Turnstile and email providers have usage limits; verify current pricing and set budgets. A verified sender domain is normally necessary for reliable customer email. Do not assume a completely free launch with a Gmail sender.
