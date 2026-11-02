# Tests and integration verification

## Automated checks

From the repository in PowerShell:

```powershell
npm ci
npm run setup:local
npm run db:migrate
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Playwright starts a local Vite server if one is not already running. Tests require `APP_ENV=local`, `EMAIL_MODE=preview` and a local token in `.dev.vars`. They refuse production/live-email configuration. Never point this suite at production.

The API tests use the real migration against an in-memory SQLite database, with a small D1 interface adapter. Browser tests additionally hit the actual local Cloudflare D1 binding. Mocked Google, Access keys, Turnstile and email-provider responses prove code behavior, not authenticated provider connectivity.

Coverage includes:

- Every requested pricing example, minimum once across services, consistent half-up rounding, tax configuration and rejection of invalid quantities.
- Known geodesic measurements, Google-compatible conversion, irregular polygons, self-intersections, distance limits, union and cross-service overlap handling.
- Mocked supported Google/Terra Draw interactions: property selection, multiple polygons, edited measurements, deletion, service assignment and map failure fallback.
- Database persistence, distinct quote numbers, client price tampering, input validation, duplicate submission and changed-payload conflicts.
- Two email records, template escaping and exact totals, provider failures, preserved quotes, stable-key retries, private note exclusion.
- Anonymous admin denial, wrong local token denial, public-host local-token rejection, signed Access audience/issuer/email validation, production verification fail-closed behavior, origin checks and rate limits.
- Contact storage, safe CSV cells, private notes/status updates and cascading retention deletion.
- Desktop/mobile page rendering, navigation, contact form submission, actual local D1 quote creation and owner dashboard management.

Browser test output and screenshots go to ignored `test-results/`; the report is in ignored `playwright-report/`. A failed run may leave clearly labeled synthetic `example.test` requests; remove those through the local owner dashboard. Never delete real customer records to clean up tests.

For this cloud workspace's installed Chromium:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

This override is not needed after `npx playwright install chromium` on Windows.

## Genuine integration checklist — requires credentials

These checks have NOT been completed merely by running automated tests:

1. Configure restricted Google browser and Geocoding server keys. Search a real authorized property and confirm the returned address, satellite location and zoom.
2. Draw irregular driveway, sidewalk and patio polygons with mouse and touch. Close polygons, use Enter/Escape as documented, drag vertices, move selected areas, undo/redo, reassign a selected service, delete one and clear all. Pan/zoom without losing saved areas.
3. Compare a known measured surface with the estimate. Overlap two driveway outlines and verify union billing; overlap different services and require correction. Test distant polygons, malformed data and a 5,000+ sq. ft. job.
4. Enable real Turnstile for the actual hostname. Submit an ordinary request and reject missing/expired/wrong-host tokens. Confirm server Geocoding refuses a forged distant property location.
5. Verify Resend sender DNS, configure the key and use your own controlled inboxes for a live test. Confirm both inboxes, price lines, quote number, disclaimer, business Reply-To and secure admin link. Inspect provider delivery/bounce information; the app's `sent` status means API acceptance only.
6. Simulate a delivery problem in a controlled development/staging configuration. Confirm the stored quote remains and the owner can retry within the 23-hour safe provider-idempotency window. Do not blindly resend older uncertain messages.
7. Protect owner routes with Access. Test owner sign-in, wrong email, expired token, missing assertion and an alternate hostname. Customers must never receive private records.
8. Test Chrome, Safari/iOS and Android touch use. Automated mobile Chromium emulation does not replace a physical-phone Maps check.
9. Verify deployed page titles, descriptions, canonical URLs, structured data, sitemap and robots rules. Inspect the browser console for Maps key, CSP, billing or quota errors.
10. Confirm phone number, business details, policy text, accessible colors/labels, actual project photos and retention policy before launch.

## Readiness record

Verified in the cloud workspace: **91 unit/component/backend tests passed; 8 desktop/mobile browser tests passed; TypeScript checking and the production build passed.** The local D1 migration also completed successfully. Live Google Maps, email inbox delivery, production Access/Turnstile and actual Cloudflare deployment remain unverified until the account-specific checklist above succeeds.
