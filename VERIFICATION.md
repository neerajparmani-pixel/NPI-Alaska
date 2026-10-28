# Verification — 2026-10-27

## Current package

Deployable Phase 1 demonstration, with navy/silver/gold branding and blue actions. Exact selected winged-lion image file is pending; the app uses an explicitly documented temporary NPI wordmark. No live work records or accounts have been connected.

## Passed

- `npm test`: 9 tests — work transitions, port evidence, repeatable spreadsheet initializer, incompatible-header protection, managed auth verification, encrypted-cookie integrity/expiry, disabled/revoked accounts, cross-origin rejection and generic errors.
- `npm run test:e2e`: 16 browser tests across desktop and 390px phone layouts — work submission/correction/approval, assignment creation, filters/empty views, keyboard focus, local offline drafts, invalid uploads, bound controls, login validation/password visibility, error recovery, sign-out and separation of identity from unconfigured work access.
- `npm run build:cloudflare`: Vite app and Pages advanced-mode worker compile successfully.
- `node scripts/smoke-cloudflare.mjs`: compiled app checked in the local Cloudflare Pages runtime; HTTPS-style security headers/CSP are served, auth safely returns 503 without configuration, phone layout has no horizontal overflow, production app shell reloads offline and no API responses are cached. No browser JS/CSP errors in the tested flow.
- `npm run format:check`: all applicable files formatted.
- `npm audit --omit=dev --audit-level=high`: zero production dependency vulnerabilities.
- Official DESIGN.md lint: zero errors; eight warnings about tokens referenced in runtime CSS/prose rather than frontmatter components.
- Archive generator checks required frontend/worker/icon files and ZIP integrity, excluding credentials, node_modules and Git metadata.
- Screenshots inspected for login and worker views on phones. PWA icon PNGs generated from the temporary wordmark, including maskable safe area.

## Static-auditor limitation

The premium strict auditor was run and reports nine `affordance.actionless-button` findings in `premium-audit.json`. It does not recognize the external event bindings in app.js `bind()`. Findings are preserved, not suppressed. Browser tests instrument listener registration and confirm enabled buttons have click handlers or form-submit behavior on worker list/detail and supervisor review; primary actions have workflow coverage. This is not a clean strict-audit result or a complete accessibility compliance claim.

## Not verified or implemented

Exact-logo integration (file unavailable), live Firebase project/accounts, runtime identity credentials, provisioning and administrator password-reset/MFA workflows, Google Sheets/Drive work API, role/contractor/site enforcement on work data, multi-device synchronization, quota/load testing, field evidence rules, retention, production backups/restoration and actual Cloudflare deployment. Backend schema tests use a mock SpreadsheetApp; auth tests use mocked provider responses. No live authentication or work-data readiness claim.

The initial Wrangler local preview failed because its config cache path was unwritable; setting XDG_CONFIG_HOME to a workspace cache fixed it. Wrangler also warned that Cloudflare Request.cf metadata could not be fetched and used its documented placeholder; the local runtime and internal checks subsequently passed.
