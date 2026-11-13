# Clickable sample audit

Captured and inspected in this run on desktop (1440px) and phone (390px). Screenshots use synthetic data. The audit covers a local prototype, not a live multi-user service.

## Flow walkthrough

1. **Operations overview — usable.** Work counts derive from the local dataset; review queue has a clear destination. Navy structure and restrained gold preserve the approved direction. [Screenshot](01-overview.png).
2. **Worker assignment — usable after revision.** Start work is visible above the phone navigation; tasks have generous label targets. Start, task validation, sample evidence, submission, correction, resubmission and approval were exercised. [Phone first screen](worker-phone.png), [full screen](02-worker.png).
3. **People and Settings — usable as a preview.** Clear labels distinguish sample profiles from real login accounts. Duplicate usernames, required fields, edit/cancel behavior, local-save failure and unsaved changes were checked. No passwords are collected. [Screenshot](03-settings.png).
4. **Management spreadsheet — usable simulation.** Real CSV download works. The interface distinguishes pending app changes, incoming sheet edits, outcomes and protected records. No real sync success is claimed. [Screenshot](04-spreadsheet.png).
5. **Locations — usable with a content dependency.** The four names confirmed by the user are present. Photos are illustrative rather than verified site photos; original image files are needed before field use. Checklist and location policies are provisional. [Screenshot](05-locations.png).
6. **Supervisor review — usable.** Date, hours, completed tasks, evidence and notes are visible together. Correction requires a reason; approved/submitted work is not editable by the worker. [Screenshot](06-review.png).
7. **Two-way conflict — usable simulation.** Old versions cannot overwrite a current title. The comparison shows both values and gives explicit keep/re-queue choices; protected records reject incoming changes. [Screenshot](07-conflict.png).

## Findings fixed

- Direct directory URLs initially reached the earlier app in Vite; explicit directory middleware now serves the sample correctly, and compiled Pages routing was checked separately.
- Unbounded inline SVGs distorted the layout; the shared icon size is now consistent across views.
- The worker’s primary action initially fell behind the mobile bottom navigation; a shorter header and image bring it into the unobscured viewport. Primary worker buttons are at least 54px tall.
- The first embedded PNG exceeded the browser’s CSS custom-property size limit in the downloadable file. JPEG encoding preserves the image content with a much smaller file; the packaged HTML now renders the embedded landscape correctly.
- Hash navigation now updates the rendered route while preserving the draft guard.

## Automated and runtime evidence

- `npm test`: 18 passing unit tests for the existing domain, auth prototype, Apps Script/backend mocks.
- `npm run test:e2e -- --workers=2`: 38 passing browser tests across desktop and phone. Fourteen cover the new sample, including two accessibility-scan runs; the others verify preserved earlier app/owner preview behavior.
- axe-core WCAG 2 A/AA, 2.1 AA and 2.2 AA tagged checks: no automated violations on tested overview, Settings, spreadsheet, locations, active worker and account-dialog states, at both widths. This is not full accessibility compliance or a user study.
- PWA shell offline reload, CSV download, empty search, form errors, storage failure, cross-tab conflict, dirty draft guards, keyboard Escape and account-dialog retention were exercised.
- `npm run format:check`: passes. Vite and Cloudflare Pages worker build: pass using writable local Wrangler config/log paths.
- The exact self-contained downloadable HTML was exercised via a local HTTP server: worker action succeeds, embedded landscape renders, no JavaScript errors or unexpected external requests. The managed browser blocks file URLs, so end-user file:// behavior remains subject to their browser’s storage rules.
- Local compiled Pages check: `/sample/` returns the sample under the existing CSP; preview sign-in role choice and Help actions work. No public deployment or live credential test was performed.
- Both ZIP archives passed integrity checks.

## Static auditor limits

The premium strict static audit is **not clean**: [JSON evidence](static-audit.json) records 17 `affordance.actionless-button` findings. Fourteen already belong to the original app/Apps Script preview. Three are the new sample’s literal filter, settings-tab and preview-role buttons. These controls use delegated `data-action` handlers that the heuristic does not detect; their behavior was verified in browser workflows and the compiled-preview check. No inline JavaScript handlers were introduced to silence the tool. The static audit does not prove or replace runtime behavior.

## Unresolved before production

Original logo and site-photo files, exact site addresses/areas and evidence policy, production account administration, RLS and server authorization, private uploads, verified Sheets editor identity, retry/reconciliation jobs and cross-device sync. See [architecture](ARCHITECTURE.md). Direct competitor web access was blocked; [research notes](RESEARCH.md) distinguish accessible source evidence from unavailable reviews.
