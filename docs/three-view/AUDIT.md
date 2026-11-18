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
