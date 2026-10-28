# NPI Alaska — Deployment handoff

## Current release

This is a **deployable Phase 1 demonstration**, not a completed live work system. It includes worker assignments, local drafts/photos/timecards, supervisor correction/approval and management views. Work records stay in the same browser. `/login` has a company username/password screen and Cloudflare authentication endpoints, but live identity service setup is required. Authentication does not yet connect to work records or roles. Do not use it for real contractor work.

**Original logo pending:** the selected silver winged-lion emblem with navy wings and gold stars is approved, but its source image was not mounted in this workspace. A temporary NPI wordmark is used. Add the exact image as `public/npi-emblem.png` (or .jpg/.webp), then rebuild; the build detects it automatically for login and app headers. Do not use an AI-redrawn logo as a substitute. Install icons currently use the temporary wordmark too.

## Files

- `NPI-Alaska-Deploy.zip`: prebuilt app at archive root, including `_worker.js/index.js` and `_routes.json` for Cloudflare Pages advanced-mode authentication routes.
- `NPI-Alaska-Source.zip`: editable source, backend schema initializer, tests, configuration and these instructions. No dependency folders or credentials included.

## Recommended deployment: Cloudflare Pages CLI

1. Unzip the source archive and open the `NPI-Alaska` folder.
2. Install Node.js 22.12+ (tested with Node 24), then run `npm ci`.
3. Add the original approved logo to `public/npi-emblem.png` if available.
4. Run `npm run build:cloudflare`.
5. Sign in to the company Cloudflare account with `npx wrangler login`.
6. Create/select the intended Pages project. The example project name in `wrangler.jsonc` is `npi-alaska-app`; adjust it to match your company project.
7. Run `npx wrangler pages deploy dist --project-name npi-alaska-app`.
8. Open the actual HTTPS URL returned by Cloudflare. `/` is the clearly labeled demonstration; `/login` is company sign-in. No localhost links are required.

For a prebuilt deployment, unzip `NPI-Alaska-Deploy.zip` into a directory, then deploy that directory with Wrangler Pages. Keep `_worker.js` as a folder containing `index.js`; don't flatten it. Do not assume a static-only drag/drop upload executes authentication endpoints. Use the CLI workflow for the complete package.

Cloudflare Pages Git builds may use `npm ci && npm run build:cloudflare`, output directory `dist`, Node 24. This task prepares files only; no remote project, accounts or deployment were created.

## Company sign-in configuration

See `backend/AUTH.md`. In the Pages project's **runtime environment settings**, configure:

- `FIREBASE_PROJECT_ID`: company-owned Firebase Authentication project ID.
- `FIREBASE_WEB_API_KEY`: API key for the configured password-verification provider.
- `AUTH_COOKIE_KEY`: a secure random 32-byte key, base64url encoded, saved as a Cloudflare secret.

Never use VITE_* for these values or commit them. No values are included in the package. Without configuration, sign-in returns a safe service-unavailable message. No password is stored in Sheets.

## Internal validation

- `npm test`: domain/schema/authentication unit tests. Provider responses are mocked.
- `npm run test:e2e`: desktop and phone browser flows; uses system Chromium where available.
- `npm run build:cloudflare`: frontend plus bundled Pages worker.
- `npm run preview:cloudflare`: local Pages runtime for internal checks, without deploying.
- `npm run package`: rebuild and create both archives under `releases/`.

The live Google Sheets/Drive service, server role and site permissions, account provisioning/reset, retention policies and pilot acceptance remain prerequisites for production use. No financial features are included in Phase 1.
