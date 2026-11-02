# Configuration and owner controls

`worker/config.ts` is the source of business and pricing defaults. `/api/config` exposes only the public configuration. Browser totals are never accepted as authoritative. `shared/types.ts` declares the data contracts; `shared/geometry.ts` and `shared/pricing.ts` enforce measurements and prices.

## Environment variables and secrets

Local values go in ignored `.dev.vars`. Production non-secret variables go in `wrangler.jsonc` → `vars`; server secrets use `npx wrangler secret put NAME` or Cloudflare's secret settings. Do not prefix secrets with `VITE_`. A browser Maps key is necessarily visible and must be restricted by origin/API.

| Name                          | Kind              | Purpose / required when                                                                                                                                          |
| ----------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                     | Variable          | `local` only for local development; `production` for deployment.                                                                                                 |
| `APP_URL`                     | Variable          | Exact website origin. Local: `http://localhost:5173`; production: actual HTTPS origin. Used for origin checks, links, sitemap and Turnstile hostname.            |
| `GOOGLE_MAPS_API_KEY`         | Public variable   | Browser Maps JavaScript + Places API (New), restricted to allowed website referrers. Map fallback appears when absent.                                           |
| `GOOGLE_MAPS_SERVER_KEY`      | Secret            | Server-only Geocoding API key; required for production map-quote submissions.                                                                                    |
| `TURNSTILE_SITE_KEY`          | Public variable   | Production public-form verification widget.                                                                                                                      |
| `TURNSTILE_SECRET_KEY`        | Secret            | Production server verification; validates hostname.                                                                                                              |
| `EMAIL_MODE`                  | Variable          | `preview` locally to save email previews; `live` for authenticated delivery. Production preview/unconfigured email reports failure instead of claiming delivery. |
| `EMAIL_FROM`                  | Variable          | Actual verified domain sender, e.g. `Rosalutions <quotes@your-domain>`. Do not use Gmail as sender.                                                              |
| `RESEND_API_KEY`              | Secret            | API key for live email.                                                                                                                                          |
| `ACCESS_TEAM_DOMAIN`          | Variable          | Actual `your-team.cloudflareaccess.com` hostname, no scheme/path.                                                                                                |
| `ACCESS_AUD`                  | Variable          | Access application's audience tag for both owner UI and API routes.                                                                                              |
| `ADMIN_EMAIL`                 | Variable          | Exact owner email accepted by JWT verification, normally `rosalutionsllc@gmail.com`.                                                                             |
| `LOCAL_ADMIN_TOKEN`           | Local secret only | Random token at least 24 characters. The setup helper generates one. Never used for production login.                                                            |
| `BUSINESS_NAME`               | Variable          | Default `Rosalutions Pressure Washing`.                                                                                                                          |
| `BUSINESS_EMAIL`              | Variable          | Default `rosalutionsllc@gmail.com`; inbox and customer Reply-To.                                                                                                 |
| `BUSINESS_PHONE`              | Variable          | Default `(813) 898-4392`. **Confirm with owner before deployment.**                                                                                              |
| `BUSINESS_SERVICE_AREA`       | Variable          | Display text; defaults to Tampa Bay, Brandon & Hillsborough County. No ZIP-code exclusion is enforced.                                                           |
| `BUSINESS_DESCRIPTION`        | Variable          | About text and structured-data description.                                                                                                                      |
| `BUSINESS_LOGO_URL`           | Variable          | Path or HTTPS URL of the official logo. Defaults to the logo prepared from the owner-provided business card at `/brand/rosalutions-logo.png`.                    |
| `BUSINESS_GOOGLE_PROFILE_URL` | Variable          | Actual Google Business Profile link; absent until owner provides it.                                                                                             |
| `BUSINESS_SOCIAL_URLS`        | Variable          | Comma-separated HTTPS social profile links.                                                                                                                      |
| `PRICING_JSON`                | Variable          | Full pricing configuration below; omit to use defaults.                                                                                                          |

The `DB` D1 binding and `ASSETS` static-asset binding are declared in `wrangler.jsonc`. There are no application passwords embedded in source code. Unit tests use synthetic credentials and mocked provider responses.

## Pricing

Use this complete object as the value of `PRICING_JSON` if changing rates:

```json
{
  "version": "owner-approved-2026-11-02",
  "ratesCents": { "driveway": 21, "sidewalk": 21, "patio": 21 },
  "minimumCents": 15000,
  "reviewThresholdSqFt": 5000,
  "taxBasisPoints": 0,
  "enabledServices": ["driveway", "sidewalk", "patio"]
}
```

The environment value is JSON text; inside `wrangler.jsonc` it must be a correctly escaped JSON string. On PowerShell you can create the string with `$pricing | ConvertTo-Json -Compress` or edit the Worker variable through Cloudflare, taking care to preserve it on deployment. Change `version` whenever rates change. Historical quotes retain their original rates and amounts.

Rates are integer cents per square foot. Measurements retain precision. Each combined service subtotal rounds half up once to cents using decimal/BigInt arithmetic, then the visit minimum is applied once. Configured tax rounds once on the resulting amount; `taxBasisPoints=0` is the default. Do not enable tax without determining the actual applicable treatment.

Examples: 400 or 700 sq. ft. → $150; 900 → $189; 1,000 → $210; 1,500 → $315; 2,000 → $420. A 1,000 sq. ft. driveway plus 200 sq. ft. sidewalk → $252, with no duplicate minimum.

Driveways, sidewalks and patios are the only automatic services. Removing a service from `enabledServices` prevents automatic quoting. Other services route to custom requests; roof soft washing stays marked as planned. Special conditions are centralized in `shared/types.ts` (`SPECIAL_CONDITIONS`); adding a condition requires a small code change there. No automatic special-treatment surcharge is invented.

## Geometry and fraud boundaries

- Closed GeoJSON Polygon rings, no holes, self-intersections, degenerate geometry or non-finite coordinates.
- Up to 30 outlines and 150 vertices total; at least 1 square foot per outline, up to 100,000 total square feet.
- Every vertex must remain within 350 metres of the verified property coordinate. Larger properties can use a custom request.
- Production resolves the selected place ID using the server Geocoding key, replaces the browser address/coordinates with the verified result, and rejects a browser location more than 150 metres away.
- Same-service outlines are unioned. Different-service overlap above a 0.5 square-foot numerical tolerance is rejected until corrected.
- Turf polygon operations plus the Google spherical radius of 6,378,137 metres give server geodesic measurements compatible with the browser. Conversion: 1 m² = 10.763910416709722 ft².
- Satellite imagery is not a survey. An owner review still confirms the final surface and price.

These are geometry bounds, not service-area ZIP restrictions. The owner decides whether to service an address.

## Logo and project gallery

The header and footer use `public/brand/rosalutions-logo.png`, isolated from the owner-provided `Back.pdf`. The black, cyan and electric-blue theme lives in `src/brand-theme.css`. To supply an original vector or another approved logo later, place it under `public/` and set `BUSINESS_LOGO_URL` to its path.

Place customer-approved photos under `public/projects/`, optimize to WebP/AVIF, remove identifying metadata as appropriate, and add pairs to `PROJECT_PHOTOS` in `src/pages/Gallery.tsx`. Each pair needs `id`, `title`, `location`, `before`, `after`, `beforeAlt`, `afterAlt`. The existing comparison slider supports multiple pairs and keyboard control. Until photos are supplied, the gallery honestly states that real photos will be added.

## Owner dashboard and data handling

Use `/admin` and sign in through Access in production. The local token is only a development convenience. Requests include summary totals, search, status/service/date filters and sorting. Quote details include stored GeoJSON, map, original prices, appointment preferences, email previews/status and private notes. Private notes never appear in public receipts or customer emails.

Changing status does not automatically send an email, create a calendar event or invoice the customer. Contact the customer before marking a job scheduled. There is no card storage or Square API dependency.

Deletion removes the quote/contact and its related geometry/email records through database foreign-key cascades. It does not recall delivered emails or remove provider logs/backups. Establish a retention policy and handle provider retention separately. CSV exports contain customer information; store and share them appropriately. CSV cells are escaped against spreadsheet formula injection.

## Cloud development environment

In this restricted workspace, package-manager and runtime caches use writable paths. The installed checkout is already isolated; use it directly rather than creating another Git worktree unless explicitly requested.

```bash
npm ci --cache /workspace/.npm-cache
npm run setup:local
WRANGLER_LOG_PATH=/workspace/.wrangler-logs npm run db:migrate
WRANGLER_LOG_PATH=/workspace/.wrangler-logs CLOUDFLARE_DEV_REGISTRY_PATH=/workspace/.cloudflare-dev-registry npm run dev
```

The Cloudflare emulator may report that optional `Request.cf` metadata could not be fetched; this local geolocation metadata is not needed by the site. Network policy for real integration testing must permit `maps.googleapis.com`, `maps.gstatic.com`, the Google map tile/API endpoints requested by the browser, `api.resend.com`, `challenges.cloudflare.com`, and the actual Access team hostname. Deployment additionally requires Cloudflare's API/auth endpoints. Do not broaden a restricted allowlist to all domains or disable TLS verification.
