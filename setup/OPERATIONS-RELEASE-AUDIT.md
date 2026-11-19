# Operations 1.0 verification

## Implemented release

NPI creates contract/site responsibilities and single-use subcontractor-admin invitations. Companies invite/approve their own workers and dispatch their own assignments. Workers capture two fresh GPS events and submit tasks, private work evidence and hours. Company review precedes NPI acceptance. NPI can inspect original event points/times, images and hour comparisons. The approved visual system is retained. Billing is deferred: finance routes/forms are removed, finance mutations are blocked and financial collections are not loaded into the operations snapshot. Existing legacy tables and records are preserved.

## Local evidence

- **57 unit/API/workbook/PostgreSQL tests passed.** PostgreSQL tests apply 001, 002 and 004 in PGlite, exercising company invitation restrictions, trusted identity binding, pending-access denial, same-request retry, single-use/revoked links, company-scoped dispatch, immutable GPS through company/NPI review and exact accepted hours. Separate contract tests cover public invitation requests, protected workbook fields, positive planning proposals, no finance proposals, private uploads, Auth failure/recovery and managed password operations.
- **124 desktop/phone browser checks passed across the repository.** The live operations suite has 20 checks across the two viewport projects, including public signup, password errors, pending access, company approval, NPI administrator invitation, company-owned assignment, both GPS events, evidence upload, claimed/company/NPI acceptance, keyboard/mobile navigation, unsaved changes, stale versions and password reset recovery. Browser provider responses are intercepted fixtures, not the user's cloud accounts.
- The live browser flows include Axe scans of login, operations forms, empty overview and signup. The complete repository static auditor reports **17 existing legacy heuristic findings**, with **zero findings in public/live**. This is not a clean whole-repository audit claim.
- DESIGN.md lint reports **zero errors and eight existing unused-token warnings**. Formatting, syntax and production/Cloudflare builds were checked. Screenshots in this package were captured locally and visually inspected; signed-in identities, company names and connection responses in those pictures are fictional.
- The four site JPEGs and approved transparent emblem are copied unchanged. The manifest points at the original 1254×1254 PNG; no alternate logo is generated. No private contract files, prices, real operational records, server secret or database password are included in the archive. The publishable API key is intentionally public.

## Installation boundary

This is a complete code/installer archive. No authenticated Supabase, Google or Cloudflare deployment was performed through this session. The customer's existing installation must apply migration 004, redeploy npi-admin, update LiveSync.gs and deploy frontend/ before the new flow works. Do not rerun the foundation/owner migrations on an existing project. A real three-role acceptance test is required after installation; local and mocked checks do not prove cloud connectivity or real provider behavior.

## Operational limits

The app requires online access for writes, fresh GPS and uploads. It does not queue offline writes. Sessions/draft recovery stay in memory; page reload requires sign-in. GPS is device-reported, not proof of physical presence. Controlled spreadsheet proposals never replace original attendance/account permissions. Register limits are documented in START-HERE. Abandoned Auth creation can be retried using the same registration reservation; revoked/expired-link failures may need trusted owner recovery. There is no automatic notification delivery, billing, invoice issuance, payment or accounting feature in this release.
