# Google backend preparation

`Setup.gs` is an idempotent, non-destructive initializer for the Phase 1 tabs in one company-owned management spreadsheet. It creates schema headers only; there is no deployed API yet. No financial tabs are needed for Phase 1. Run only after the company confirms spreadsheet ownership and schema.

## Deployment blockers

1. Company-issued credentials confirmed. Configure and test the managed password verifier described in AUTH.md. Do not store passwords or password hashes in Sheets.
2. Supply the company spreadsheet and restricted Drive folder via configuration, and define real user/site/contractor access. Never send credential values in chat.
3. Connect authorized backend endpoints, test them against a dedicated pilot spreadsheet, then deploy Cloudflare Pages. Demo role selection must be removed from live mode.

## Live API contract to implement after identity decision

Requests go through a same-origin Cloudflare endpoint to avoid browser-to-Apps-Script redirect/CORS problems. Cloudflare performs protocol routing; Apps Script must independently verify identity and authorization. Never trust role, email, user ID or contractor ID submitted by the browser.

- `session`: resolve verified identity to active UsersRoles entry; return safe profile and permitted roles.
- `assignments.list`: bounded results for self (worker), explicitly assigned sites (supervisor), authorized operational scope (management).
- `assignments.create`: supervisor/admin authority, valid active worker, contractor, site and equipment, durable request ID.
- `work.start` / `work.saveDraft` / `work.submit`: worker must own assignment; server-controlled status/time and expected version; validate tasks and evidence per site.
- `attachments.upload`: verify record access; validate decoded file size/type/signature; create private Drive file; never public-share it.
- `attachments.read`: authorize parent work record before delivering file content; no owner-privileged Drive URLs to unauthorized users.
- `work.review`: supervisor for the assigned site, Submitted state only; approve or request correction with required reason.
- `dashboard`: authorized aggregates only, not a full spreadsheet dump.

Use ScriptLock around state/version and idempotency checks. Persist operation results so retrying the same request cannot duplicate work. Sheet write plus audit failure requires a recoverable operation design; Sheets does not provide multi-table transactions. Protect cells against formula injection when writing free text. Do not record bearer tokens, passwords or full file data in audit logs. Add configured upload limits, pagination, quota testing and backup/recovery verification before field release.

Times store UTC; UI displays Alaska time. Missing GPS must remain explicit and never be fabricated. Photo counts, permitted task categories, retention and location requirements need company confirmation.
