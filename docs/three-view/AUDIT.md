# Three-view sample: verification

## Captured flow

1. **NPI Admin overview — usable:** all fictional companies, site-level recorded/accepted hours, assignment creation and final verification. [Screenshot](npi-admin.png).
2. **Subcontractor Admin overview — usable:** own-company data only, team profiles and a separate company review stage. [Screenshot](subcontractor-admin.png).
3. **Worker assignment cards — usable:** simple task/equipment cards and personal history, with fewer navigation choices. [Phone screenshot](worker-phone.png).
4. **Worker work detail — usable:** a prominent location-required check-in/out action, task checklist, evidence and personal hours. [Screenshot](worker-job.png).
5. **Company review — usable:** the claim is reviewed by the company before NPI can accept it. [Screenshot](company-review.png).
6. **NPI verification — usable:** recorded/claimed/accepted quantities remain separate; changes require a reason. [Screenshot](npi-review.png).

Screenshots were recaptured after the user-requested professional refinement: consistent Source Sans 3 typography, compact branding, navy desktop sidebar, labeled administrator page selection and worker bottom navigation, restrained navy/gold summary, and responsive metrics/activity/attention columns. [Login screenshot](login-desktop.png). The original emblem file and site photographs are not embedded; Settings/local pickers accept originals unchanged.

## Results

- `npm test`: 27 unit tests pass, including reused hour/location/review domain gates.
- `npm run test:e2e -- --workers=2`: 98 browser checks pass (96 in the full run plus the two exact-artifact export checks after correcting their development-server fixture) across desktop and phone. Forty-four exercise the three-view, management, image and test-transaction flows, with the remainder checking the preserved earlier samples.
- New workflow checks: exactly three view choices; company/worker scope and company-scoped worker assignment; no visible currency amounts or credential persistence; masked preview login and role entry; individual/crew attendance; independent required event positions and clearing a prior example position when requesting fresh device GPS; denied GPS; raw evidence preservation; contractor-first review; NPI adjustment; correction reasons; hauling timecard gate; unpriced allocation and duplicate protection; assignment creation; worker-profile validation; dirty-dialog protection; storage failure; search empty/clear; phone overflow; offline reopening; navigation and no page overflow at 320, 390, 768, 1024 and 1440px.
- axe-core WCAG A/AA-tagged scans report zero automated violations on the tested NPI overview, orders, review, hours, sites, billing and settings at both widths. This is not formal accessibility compliance. Initial role-helper contrast failure was corrected before final verification.
- The exact self-contained downloaded HTML was tested over a local HTTP route: example check-in succeeds and checkout becomes available, with no JavaScript errors. Local-file URL use is blocked by the managed browser and depends on the user's browser support.
- ZIP integrity checks pass. The packager uses an explicit source allowlist and asserts no document files appear. No uploaded contract/OCR files are copied to application or GitHub.
- Formatting and production build checks run as part of final delivery. Supabase/Sheets/real identities are not configured or integration-tested.

## Static tool limits

[Strict static auditor JSON](static-audit.json) records 17 heuristic `affordance.actionless-button` findings. All are in previous surfaces. Runtime tests exercise the three demo choices and native workspace selector. The repository-wide static result is not clean and is not described as passing. No inline handlers were added to hide the heuristic warning.

## Scope and remaining risks

This is a bounded, synthetic, device-local sample. Actual authentication/RLS, durable server events, identity verification, private uploads, real proximity policy, real per-service rules, immutable server approvals, two-way Sheets sync and operational acceptance remain future work. No financial amounts, contract documents, real account creation, invoice delivery or money transfer are implemented. The user authorized design judgment beyond exact screenshot copying. Missing original image assets prevent an exact branding match.

Typography: self-hosted Source Sans 3 at 400/600/700, 16px body, 32px desktop and 27px phone page headings. [Phone login](login-phone.png) · [Tablet](tablet-overview.png). A 320px site-summary overflow was found and corrected; no page-level clipping was used to hide it. Native tables retain their own horizontal scroll regions. The previous condensed heading font was removed.

## Management extension checks

Schedule edits are limited to unstarted, visible assignments. Request scheduling creates a linked work order through the existing form. Reports preserve company scope and export filtered data. The local workbook validates the entire batch before mutation, previews changes, rejects stale/duplicate/protected/invalid rows, revalidates at commit and records the applied revision. Workspace edits store no credentials. Six additional browser scenarios run on both projects; four pure CSV/workbook unit tests cover quoting, atomicity and formula handling.

Additional axe-tagged scans pass for schedule, reports, workbook and settings at desktop/phone widths. Overflow checks also cover 320, 390, 820 and 1440px. Eight final accessibility/responsive/worker-navigation checks passed after the last typography adjustment. The 320px report-date grid was corrected through intrinsic input sizing rather than page clipping.

[Dispatch](schedule-desktop.png) · [Reports](reports-desktop.png) · [Phone report](reports-phone.png) · [Workbook](workbook-desktop.png) · [Settings](settings-desktop.png).

Live research attempts to the prior demo and official comparison/court pages returned proxy 403 responses. No current source verification, court addresses or authentic site photos are claimed. See FEATURES.md for source links and the backend boundary.

## Pictures and one test transaction

Ten additional desktop/phone checks cover one idempotent test-record creation, the full worker/company/NPI approval path, independent event positions, original small/large image bytes, IndexedDB reload persistence, invalid-clipboard recovery and personalized-export privacy. The exact standalone HTML was served unmodified for export checks because Vite converts inline modules into development-only proxy scripts; those scripts must not enter a supposedly self-contained personalized download. These two corrected artifact-fixture checks pass.

A separate browser walkthrough of the final packaged bytes completed one synthetic record and NPI approval with zero JavaScript errors. [Worker test screen](test-transaction-phone.png) · [Approved transaction](test-transaction-approved.png) · [Original-image paste control](paste-original-logo.png).

No actual logo/courthouse image is bundled: inline assets remain inaccessible to workspace tools, and the attempted source fetches were proxy-blocked. Synthetic clipboard bytes in automated tests are not published as artwork. Users can paste the originals into the app and download a standalone copy with those images embedded; credentials and operational records are excluded.

Simplification review: removed the unconnected sample login fields, collapsed test controls, compacted worker totals and added recorded/claimed/difference comparisons to approval queues. The narrated tutorial uses actual sample screenshots and completes DEMO-105 at 1.75 accepted hours. Video playback and complete H.264/AAC decode passed. Strict static audit still reports 17 pre-existing actionless-button heuristic findings in older surfaces; the repository audit is not clean. Original chat logo/site photographs remain unavailable as local assets and are not represented as embedded.

Validation for the simplified sample: 98 Playwright checks passed across desktop and mobile; 27 unit tests passed; Cloudflare build and changed-file formatting checks passed. Both downloadable ZIPs pass integrity checks and include the offline guide.

## Local rates and setup foundation

Rates use shared Settings panels, fields, dialogs, tables and save guards. Blank customer/subcontractor lists, integer-cent calculations, effective-date overlap checks, edits, explicit CSV export and NPI-only preview access were exercised on phone and desktop. Actual database policies, real authentication, live workbook sync and invoice issuance are not implemented by the setup foundation. SQL was not run against a live Supabase project. Apps Script initializer is unit-tested with mocked Google services; actual owner authorization remains unverified.

Standalone package screenshots: rates-desktop.png, rates-phone.png, rate-form-desktop.png and rate-form-phone.png. Exact packaged HTML renders with no JavaScript errors on both widths. The original asset files remain pending; Google, official court and Wikimedia URLs returned proxy 403. No generated or unverified building substitutes were added. Strict audit still reports 17 legacy actionless-button heuristic findings, with none added by rate settings. DESIGN.md lint: zero errors, eight warnings.

An image-paste regression test originally read browser storage before asynchronous artwork persistence finished. It now waits for the saved image before asserting; the ten image/transaction tests pass. Unit suite: 32 passed. Cloudflare build and changed-file formatting passed. Both backend setup files are foundations, not evidence of deployed services.

Final full browser rerun after the image-persistence test correction: 100 passed across desktop and mobile. Final unit rerun: 32 passed. The setup archive passes integrity and expected-file checks and contains no private document files.

Settings cleanup removes development guidance about emblem appearance and separates setup diagnostics from everyday company/rate settings. No live connection is implied. Available plugin discovery found no callable web-search or image-retrieval plugin. Google, official Alaska courts and Wikimedia requests again failed with proxy 403; verified site images remain unavailable, and no substitutions were added.

Settings cleanup validation: 24 focused and 100 full browser checks passed across desktop/mobile; 32 unit tests passed. Packaged Settings was visually inspected at 390px and 1440px, with setup collapsed initially. Cloudflare build, formatting and ZIP generation passed. Strict audit retains the 17 pre-existing findings; no new rate/settings findings.

## Supplied artwork integration

The uploaded ZIP provided four site JPEGs and two layout references. Four source photos are bundled unchanged, proven by ARTWORK.json hashes; the logo is a CSS presentation crop of the desktop reference. No generated enhancement, architectural reconstruction or substitute logo was created. Source emblem resolution is limited to the provided screen photograph. The port has no supplied image.

Default artwork uses dedicated assets.js and sitePhoto()/brandImage() owners, while user-selected overrides remain intact. PWA v9 caches all bundled files; standalone packaging embeds the original JPEG bytes. Full-size viewing uses the existing accessible dialog and scoped photo-view action. Site images are not work-evidence records. Phone assignment photo height is 132px so the first assignment action remains visible above bottom navigation at 390×844.

Four new browser checks cover defaults, actual image decoding, full-size view, standalone inlining and custom override persistence on desktop/phone. A pre-existing large-image test now waits for asynchronous persistence instead of treating the newly present default logo as proof of upload completion. Focused artwork/transaction suite: 14 passed. Unit suite: 32 passed. Cloudflare build passed. Strict audit retains 17 prior legacy findings. Actual standalone screenshots were inspected for welcome, site gallery and worker phone views.

Final full browser run: 104 passed across desktop and mobile. Final original-image hash, packaged-byte equality and ZIP integrity checks passed. DESIGN.md lint has zero errors and eight existing warnings; changed-file formatting passed. NPI-Image-Preview.png shows actual app screenshots and is included in the downloads.

Transparent-logo/domain revision: the opaque reference crop is replaced with an image-tool-assisted PNG derivative with genuine alpha transparency. Product Design audit guidance was used to capture, inspect and report six current states in DEPLOYMENT-AUDIT.md and setup/AUDIT-REPORT.html. A missing welcome-region accessible name was fixed. Final scans: zero axe violations/overflow/JavaScript errors. 104 browser and 32 unit tests passed; real domain and backend readiness remain blocked and are explicitly reported.
