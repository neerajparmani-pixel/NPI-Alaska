# Three-view sample: verification

## Captured flow

1. **NPI Admin overview — usable:** all fictional companies, site-level recorded/accepted hours, assignment creation and final verification. [Screenshot](npi-admin.png).
2. **Subcontractor Admin overview — usable:** own-company data only, team profiles and a separate company review stage. [Screenshot](subcontractor-admin.png).
3. **Worker assignment cards — usable:** simple task/equipment cards and personal history, with fewer navigation choices. [Phone screenshot](worker-phone.png).
4. **Worker work detail — usable:** a prominent location-required check-in/out action, task checklist, evidence and personal hours. [Screenshot](worker-job.png).
5. **Company review — usable:** the claim is reviewed by the company before NPI can accept it. [Screenshot](company-review.png).
6. **NPI verification — usable:** recorded/claimed/accepted quantities remain separate; changes require a reason. [Screenshot](npi-review.png).

Screenshots were captured and inspected in this run. The user-selected hosted reference is network-blocked; these are prototype checks, not a fidelity comparison with that reference. Original site-photo embedding is also pending actual files or applied research access.

## Results

- `npm test`: 23 existing unit tests pass, including reused hour/location/review domain gates.
- `npm run test:e2e -- --workers=2`: 72 browser tests pass across desktop and phone. Eighteen exercise the new three-view adapter, with the remainder checking the preserved earlier samples.
- New workflow checks: exactly three view choices; company/worker scope and company-scoped worker assignment; no visible currency amounts or password collection; individual/crew attendance; independent required event positions and clearing a prior example position when requesting fresh device GPS; denied GPS; raw evidence preservation; contractor-first review; NPI adjustment; correction reasons; hauling timecard gate; unpriced allocation and duplicate protection; assignment creation; worker-profile validation; dirty-dialog protection; storage failure; search empty/clear; phone overflow; offline reopening.
- axe-core WCAG A/AA-tagged scans report zero automated violations on the tested NPI overview, orders, review, hours, sites, billing and settings at both widths. This is not formal accessibility compliance. Initial role-helper contrast failure was corrected before final verification.
- The exact self-contained downloaded HTML was tested over a local HTTP route: example check-in succeeds and checkout becomes available, with no JavaScript errors. Local-file URL use is blocked by the managed browser and depends on the user's browser support.
- ZIP integrity checks pass. The packager uses an explicit source allowlist and asserts no document files appear. No uploaded contract/OCR files are copied to application or GitHub.
- Formatting and production build checks run as part of final delivery. Supabase/Sheets/real identities are not configured or integration-tested.

## Static tool limits

[Strict static auditor JSON](static-audit.json) records 18 heuristic `affordance.actionless-button` findings. Seventeen are in previous surfaces. The one new finding is the literal role-choice button with delegated `data-action` handling; runtime tests exercise all three choices. The repository-wide static result is not clean and is not described as passing. No inline handlers were added to hide the heuristic warning.

## Scope and remaining risks

This is a bounded, synthetic, device-local sample. Actual authentication/RLS, durable server events, identity verification, private uploads, real proximity policy, real per-service rules, immutable server approvals, two-way Sheets sync and operational acceptance remain future work. No financial amounts, contract documents, real account creation, invoice delivery or money transfer are implemented. Exact visual reproduction of the preferred hosted page remains blocked until it can be inspected.
