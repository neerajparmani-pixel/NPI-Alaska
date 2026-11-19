# Operations 2.0 — release audit

This audit covers the local release candidate, not an independently certified production deployment. Product Design screenshot review, Lighthouse 13.6, axe-core 4.14 and the Frontend Design Premium scanner were used. No external human penetration test or Codex Security scan was performed.

## Results

- 70 unit/API/database tests passed, including company isolation, version checks, idempotent writes, exception approvals, photo policies, email outbox claims and account-session races.
- 138 desktop/mobile browser cases passed (entire repository suite, including legacy prototype checks). TEST-RESULTS.json records the final stable-server run.
- Fourteen screenshot states checked with axe: zero automatically detected violations. Lighthouse flow accessibility and best practices: 100. These results do not establish complete WCAG conformance; rules marked incomplete still need manual review.
- Isolated sign-in Lighthouse: performance 75, accessibility 100, best practices 100, SEO 91. Performance remains a tuning opportunity, particularly the detailed company emblem and image decoder bundle.
- Active first-party deterministic scan: zero findings; seventeen existing legacy-prototype findings are outside this shipped frontend.
- Production npm dependency audit: zero reported vulnerabilities at audit time.
- Real response CSP checked locally with direct camera capture and HEIC decoding; no unsafe-eval needed. HEIC was checked with one fixture, not every device/codec variant.

## Scope and safeguards

Three roles only. Company administrators invite and approve their own workers. NPI can inspect assignments, creators, crews, recorded GPS, original attendance, claimed and accepted hours, issues and private photos. Normal evidence-required submissions need before/after images; inability or partial completion requires a reason and explicit reviewer acknowledgement. Original attendance and original uploads are retained. Stamps identify device-reported capture/preparation time; server upload time is displayed separately. GPS is advisory evidence, not a guarantee that a device or photograph is authentic.

The seven visible workbook tabs are Overview, Work, Attendance, People, Setup, Issues and Evidence & history. Operational records flow to Sheets. Only permitted site and unstarted-work planning fields flow back as versioned proposals for NPI approval. Attendance, approvals, passwords and private upload bytes cannot be overwritten from a cell. Invitation metadata excludes secret invitation hashes. The workbook is a management interface, not an exact copy of the app. Refresh refuses unsent edits.

Work search covers authorised records in pages of fifty. Reports explicitly describe the latest 500 loaded records, not an unlimited historical ledger. Workbook exports stop at a 20,000-row safety guard. Photos support common image formats, up to 20 MB each, twelve files/60 MB per batch, plus PDF timecards. Files are queued in memory until successfully saved; closing the page can lose unsaved photos. No automatic original-file deletion or storage-quota guarantee is provided. Registered original-byte totals are estimates; use the Supabase console for actual storage usage including previews.

## Deployment acceptance still required

Apply migration 005 once after existing 004; update the Edge Function and workbook script; then deploy the included frontend to the existing Cloudflare Pages project. Preserve existing secrets and DNS. Confirm live cross-company RLS/storage isolation, camera/GPS permissions on target phones, invitation email delivery, signed photo access, workbook owner permissions and scheduled sync. Google Apps Script was checked using a VM harness, not the real Google runtime.

Email requires a verified sender, provider key and installed dispatcher trigger. Outbox success means provider acceptance, not confirmed inbox delivery. Alerts refresh in the foreground every thirty seconds; closed-app push notifications are not implemented. Before enabling scheduled actions, review all recipient addresses and the production test issue.

Videos show the actual local app with an intercepted fictional backend, simulated GPS and Chromium test-camera images. The 1.75-hour transaction is a fixture. Narration is synthetic female speech conditioned on an Australian-English reference; no human presenter appears. Each video includes headings, captions and written task instructions. Billing is excluded.
