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

The premium strict auditor was run and reports fourteen `affordance.actionless-button` findings in `premium-audit.json`. It does not recognize the external event bindings in app.js `bind()`. Findings are preserved, not suppressed. Browser tests instrument listener registration and confirm enabled buttons have click handlers or form-submit behavior on worker list/detail and supervisor review; primary actions have workflow coverage. This is not a clean strict-audit result or a complete accessibility compliance claim.

## Not verified or implemented

Exact-logo integration (file unavailable), live Firebase project/accounts, runtime identity credentials, provisioning and administrator password-reset/MFA workflows, Google Sheets/Drive work API, role/contractor/site enforcement on work data, multi-device synchronization, quota/load testing, field evidence rules, retention, production backups/restoration and actual Cloudflare deployment. Backend schema tests use a mock SpreadsheetApp; auth tests use mocked provider responses. No live authentication or work-data readiness claim.

The initial Wrangler local preview failed because its config cache path was unwritable; setting XDG_CONFIG_HOME to a workspace cache fixed it. Wrangler also warned that Cloudflare Request.cf metadata could not be fetched and used its documented placeholder; the local runtime and internal checks subsequently passed.

## Spreadsheet-first addition — 2026-10-28

The separate spreadsheet-first/Code.gs backend and Index.html frontend support an owner-only bound-script test, with real Sheets/Drive calls in the implementation. Unit tests execute the actual backend against mocked Apps Script services. Browser tests connect the actual HTML to that backend mock and exercise the full lifecycle on desktop and phone, including separation of unsaved worker drafts from reviewer records and app-owned discard confirmation. Owner checks reject empty/different identities. Signature/size/private-folder checks, idempotency, stale versions, pagination, headers and formula safety are covered. No real Google account execution has occurred; the user's live spreadsheet test is still required. This is not company worker authentication or public deployment.

Spreadsheet-first delivery checks: 14 unit tests pass, including five tests of the new backend. The full browser suite passed 20 tests; four spreadsheet-specific desktop/phone tests also passed after hardening the create response to avoid follow-up-fetch retry ambiguity. Formatting passes. The existing frontend and Pages worker still compile. The three-file spreadsheet ZIP passes archive integrity and credential-pattern checks. Real Apps Script authorization/execution remains to be tested in the user's private Google account.

## Full-page and multi-tab revision — 2026-10-28

18 unit tests pass. Eight spreadsheet browser tests pass on desktop/phone, covering the full work lifecycle, owner-only access, saved spreadsheet binding for doGet, multi-tab projections and recovery after a failed report write, editable workspace settings, preservation of settings through setup/rebuild, separation of unsaved worker drafts from review data, disabled/unconnected employee account actions and initial error recovery. A missing UTF-8 declaration was found through the failure-path browser check and fixed. Screenshots of Settings were inspected. All these checks still use mocked Google services; no live Google deployment/account operation is claimed. The privately uploaded reference was inspected as data only and was not executed, edited or published.

Final revision verification: all 24 browser tests passed, including the eight revised spreadsheet tests. The existing PWA frontend and Pages worker compiled. The static audit now reports 14 external-handler detection findings (no new rule categories); this remains documented rather than represented as a clean strict audit. The original reference ZIP was not executed or included in any archive/commit.

## Clickable PWA proposal — 2026-11-13

See docs/prototype/AUDIT.md for current-run screenshots, source research limitations, 38 passing desktop/mobile browser checks, 18 passing existing unit tests, axe scan scope, packaging verification, and static-auditor findings. The new `/sample/` flow uses only synthetic local data, supports a scoped offline shell, and simulates two-way Supabase/Sheets reconciliation. No production backend or accounts were connected. Downloads are generated by scripts/package-sample.py. The earlier app and owner spreadsheet preview remain separate.

## Subcontract workflow revision

The separate `/operations/` sample implements the user-confirmed contractor-first hours approval, NPI evidence cross-check, individual/crew totals, independent required locations at both events and mixed customer/subcontractor billing examples. Current evidence: docs/operations/AUDIT.md and tests/operations.test.js plus tests/browser/operations.spec.js. Real location tests use mocked browser positions; no field worker is tracked. Original photos and authoritative address verification remain blocked by missing original files/current network policy. Research-access draft is saved but not applied. Supabase, Sheets, real identities, invoice sending and banking remain unconnected.

Final revised-sample verification: 23 unit tests and 54 desktop/mobile browser tests pass. axe scans pass on the tested views, format checks and the production build pass, and the standalone HTML and ZIP integrity are verified. Static audit retains 17 delegated-button findings in earlier surfaces, with no operations-source violations in the saved report.

## Exactly three views — 2026-11-13

New /three-view/ adapter: NPI Admin, Subcontractor Admin and Subcontractor Worker. 23 unit tests and 72 desktop/mobile browser tests pass, including 18 new adapter checks. Accessibility scans pass on tested screens; strict static audit retains 18 delegated-handler heuristics (one in new surface), documented in docs/three-view/AUDIT.md. The selected hosted visual target is blocked by the network policy; no exact-match claim. No uploaded contracts, actual prices, private contacts or document text were copied into the new app or packages. Billing is unpriced quantities/status only. Exact standalone HTML and archive integrity are checked; backend connections remain unconfigured.
