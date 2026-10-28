# NPI Alaska — Phase 1

A working mobile-first **local demo** of work tracking and supervisor approval. Not connected to a real spreadsheet, live login, Drive or Cloudflare deployment yet. Do not use for company records.

## Run

Requires Node.js 22.12+ (Node 24 used during development).

```sh
npm ci
npm run dev
```

## Try the workflow

1. In Worker view, open the Courthouse assignment and select Start work.
2. Select completed tasks, add at least one work photo and submit for review.
3. Switch the clearly labeled Demo view to Supervisor, open Review work and approve or request a correction with a reason.
4. In Worker view, corrections appear under My work; submitted/approved jobs appear under My history.
5. Management view shows site activity and status totals. Supervisors can create new demo assignments.
6. Tote Port work additionally asks for completed loads and a signed timecard.

Changes and attachments persist in this browser's IndexedDB. They do not synchronize across users/devices. Demo worker identity is Alex Morgan. Clearing site data removes demo records. GPS is requested only on tap and is optional in the demo. PWA shell caching applies to production builds; local drafts are not a real offline submission queue.

## Verify

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use `/usr/bin/chromium` when present; otherwise install the Playwright browser with `npx playwright install chromium`. Tests cover desktop and 390px phone layouts. Screenshots are written to ignored test-results folders.

## Cloudflare build settings

Build command: `npm run build`. Output: `dist`. The deployable build is currently demo-only. No deployment has been performed. Use an HTTPS origin for installation/location support. Raster and maskable install icons are included using the temporary NPI wordmark; replace with final approved branding and test installation on target phones before release.

## Next: real backend

See `backend/README.md` and `backend/Setup.gs` for schema initialization and the live service contract. Company username/password login is implemented separately; identity provider setup, real roles and work-data connection remain pending. Deployments, role enforcement, multi-device work, quota behavior and private file delivery must be implemented and tested before field use.

Product decisions: PRODUCT.md. Visual system: DESIGN.md. Behavior: UX-CONTRACT.md.

## Deployable files

See DEPLOYMENT.md. Run `npm run package` for a Cloudflare-ready ZIP and editable source ZIP. `npm run build:cloudflare` builds the frontend and Pages auth worker. Exact approved logo asset is pending: place it at public/npi-emblem.png and rebuild. Until then the approved navy/silver/gold palette uses a temporary NPI wordmark. Company login at `/login` uses managed verification and requires the runtime configuration in backend/AUTH.md. No live deployment has been performed.

## Download from GitHub

For the prebuilt demo, open [`downloads/NPI-Alaska-Deploy.zip`](downloads/NPI-Alaska-Deploy.zip) and click **Download raw file** (download icon). For all editable source, use GitHub's **Code → Download ZIP**. See [DEPLOYMENT.md](DEPLOYMENT.md) before deploying. This is a demo, not the completed live spreadsheet-connected app.

## Test inside Google Sheets first

Use the new [spreadsheet-first instructions](spreadsheet-first/README.md). Paste [Code.gs](spreadsheet-first/Code.gs) and [Index.html](spreadsheet-first/Index.html) into a script bound to a new private test spreadsheet, run `setupNpiTest`, then reload the spreadsheet and open **NPI Alaska Test → Open app**. This test writes records to a separate tab and files to private Drive storage; only the spreadsheet owner can use it. It does not require Cloudflare or Firebase and is not live worker authentication.

## Updated full-page spreadsheet preview

The [version 2 guide](spreadsheet-first/README.md) replaces the earlier dialog-only instructions. Replace both spreadsheet-first files, run setupNpiTest again, then deploy a **private Google Apps Script Web app** (execute as Me, access Only myself). The returned URL opens the full-page interface. This adds eight readable backend tabs and preserves the internal record store; employee logins are not connected yet.
