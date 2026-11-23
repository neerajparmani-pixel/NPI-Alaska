# Alaska NPI Operations v3.2.0

## Start here

Extract this entire ZIP and open START-HERE.html. It includes the frontend, database migrations, self-contained Edge Function, seven-tab workbook script, complete test sources, three current narrated videos, captions and written task instructions. Only the CONTENTS of frontend/ go to Cloudflare. No actual contracts, prices, passwords or server keys are included. Billing and invoices remain excluded.

This is an upgrade of your existing installation. Keep your Supabase project, existing NPI administrator, spreadsheet, Cloudflare npi-alaska project and alaska.npi6030.com domain. Your original attendance, uploads, work records and existing logins remain. Do not recreate accounts or repeat migrations 001–007. Existing unused invitation links are revoked by this upgrade; create new single-use email-bound links afterwards.

## Upgrade from your installed v3.1.0

1. Finish pending uploads, keep your usual database/workbook backup, and arrange the update outside active work. The changed frontend requires backend migration 008. Existing accounts are retained; this package does not deploy itself.
2. In Supabase SQL Editor run backend/supabase/008-v3-2-accounts-reports.sql ONCE, after 007. It is transactional. If an error appears, stop and keep the exact error. Do not rerun 001–007 or reset the database. If you already applied 008 successfully, do not apply it again.
3. Open backend/supabase/npi-admin.ts with Notepad and copy its ENTIRE contents into the main file of your EXISTING Edge Function. Deploy updates. The file is self-contained; no additional source files need to be added in the dashboard editor. Keep Verify JWT with legacy secret OFF: the broker and database enforce user identity/permissions, with a separate secret for the workbook.
4. Keep the existing function URL. Your function is displayed as npi-admin but its actual URL ends in swift-processor. This package configures frontend/live/config.js and LiveSync.gs to use swift-processor for your project. Function names in file paths are packaging labels, not instructions to create another function. Preserve SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NPI_ORIGIN, NPI_SHEETS_ID and NPI_SHEETS_TOKEN. Never put server keys in the frontend, sheet cells or chat.
5. Configure the verified email sender below BEFORE inviting new people. Without it, registration shows a clear setup error instead of activating unverified users. Existing sign-ins continue to work.
6. In your existing workbook choose Extensions → Apps Script. Replace only the existing LiveSync.gs with backend/google-sheets/LiveSync.gs. Preserve Script Properties, including NPI_SHEETS_TOKEN and NPI_MANAGER_EMAILS. Keep one onOpen function. Do not deploy Apps Script as a web app. Save and run npiPullLive, then reload the workbook.
7. If Apps Script says a target tab contains unrelated data, rename that old tab to a distinct backup name and retry; never erase it. Successful refresh creates or updates Overview, Work, Attendance, People, Setup, Issues, Evidence & history. After this v3.2 refresh, NPI Operations → Hide legacy tabs preserves all data while hiding recognised old tabs. Unrecognised custom sheets remain visible. No tabs are deleted.
8. In Cloudflare → Workers & Pages → your existing npi-alaska Pages project, create a new PRODUCTION deployment. Upload the CONTENTS of frontend/: index.html, live/, three-view/ and the accompanying root files. Do not upload this complete ZIP, backend/, source/ or training/. Keep your existing custom domain. No Spaceship or DNS change is needed for the app.
9. Open https://alaska.npi6030.com/live/ online. Finish local photo queues before selecting Update app. Confirm Settings shows v3.2.0. Use the existing NPI login first, then run the acceptance checks below.

If an installation has not reached 007, apply its missing migrations in order first using the prior guide. New projects alone use 001, 002, confirmed owner setup in 003, then 004–008 in sequence. Never use that fresh-install path over this existing installation.

## Email sender and password recovery

Use the existing Resend integration. Create or open the Resend account, add a sending domain you control, and verify its DNS records exactly as Resend provides them. Your DNS is managed in Cloudflare. Add only the required email records; leave the Alaska app CNAME unchanged. A verified subdomain such as mail.npi6030.com can keep sending setup separate.

In Supabase → Edge Functions → Secrets, set NPI_EMAIL_API_KEY to the Resend API key and NPI_EMAIL_FROM to an approved sender such as Alaska NPI <accounts@mail.npi6030.com>, using your actual verified domain. Keep these server-only. Preserve NPI_ORIGIN as https://alaska.npi6030.com. In Supabase Authentication → URL Configuration, set the Site URL to https://alaska.npi6030.com and allow https://alaska.npi6030.com/live/ as a redirect for recovery links. No Supabase SMTP setup is required for this package's Resend-based verification and recovery emails.

Verification emails are sent immediately when a person registers. They contain a 24-hour, single-use verification link; only its hash is stored in application tables. If delivery fails after account creation, the app offers Resend verification rather than making duplicate accounts. Recovery emails use Supabase-generated private recovery links and let the person choose a new password. Administrators cannot set or view another person's password. Unknown-account recovery/resend requests use a generic response, so they do not reveal whether an email is registered.

Approval/status and issue notification emails use the existing queue. Configure NPI recipients and company recipients separately in Settings. In Apps Script use npiInstallLiveTriggers only if automatic sync/email triggers are not installed. The dispatcher runs every minute; Sheets refresh runs every five minutes. Test actual inbox/spam delivery. A queued or provider-accepted email is not a guarantee of inbox delivery. There is no closed-app native push.

Legacy accounts using synthetic usernames@users.npi6030.com can still sign in. Their placeholder address cannot receive recovery emails. The project owner can update that existing identity to the person's real verified email in Supabase Authentication while preserving its user ID, profile and original work history. Do not delete/recreate an existing identity just to change its email.

## Invitations and multiple administrators

Use People & access → Invite person. NPI may invite NPI administrators or subcontractor administrators. A subcontractor administrator may invite workers only for their own company. NPI and each subcontractor can have multiple administrators.

Enter the person's real email, choose the permitted role, and select the company for a subcontractor administrator. Copy and share the resulting private link. Initial invitation links are shared by you; they are not automatically emailed. Each link is single-use, tied to that email and expires in 72 hours. Revoke blocks a link; Create replacement link revokes the prior unused link and creates a new one for the same person/scope. Used invitations are retained as history, not reused.

The recipient opens the link, sees their fixed company/role/email, enters their name and chooses their own username/password. Passwords need at least 12 characters and at most 72 UTF-8 bytes. Verify email, then await approval. Email verification alone grants no work access.

- A new NPI administrator is approved by the NPI administrator who invited them.
- A subcontractor administrator is approved by an active NPI administrator.
- A worker is approved by an active administrator of their own subcontractor company.

Use Pending approvals to approve or decline verified registrations. An unverified registration remains visibly pending and cannot be approved. Users can sign in with their email or username after verification; pending users see only their account status until approved. Registration tickets can resume uncertain requests in the same browser tab when the invitation is reopened; they contain no password or raw invitation token. Do not change the entered name/username while a previous request is uncertain.

People shows active, declined and paused accounts. The responsible administrator can Reopen review after an accidental decline; the account returns to pending, with no access until approved. Pause/restore access retains work records. Self-suspension is not offered, and database protection prevents deleting or disabling the last active NPI administrator. Recent account history shows the latest 200 invitation/access actions with actor and time; the underlying audit remains in the database and workbook. Never share one administrator login between people.

## Worker daily flow

Start work → site/service → before photos and ruler measurement where required → GPS check-in → services/photos/issues → after photos → GPS checkout → submit hours. No daily assignment is required. Workers may record an approved company crew. Multiple line/sub-line items share one attendance timeline per worker; service quantities never multiply attendance hours.

Both check-in and checkout require fresh device GPS. Site selection may be automatic or manual, but manual site/address labels are never presented as captured GPS. Location links show the captured point. Before/after evidence, multiple chosen files and one-by-one camera capture remain. Ruler evidence must be a fresh app-camera before photo with a capture timestamp, unique to its service. Confirm or correct optional automatic readings; manual inches remain available.

Below 2 inches is included and requires explicit acknowledgement by both reviewing administrators; it creates no billing entitlement. New snow services stay draft until contiguous zero-up bands through an open-ended highest band are configured. Partial outcomes alone never bypass required evidence. An explicit missing-evidence reason is required and reported for review.

Company review precedes NPI verification. NPI can inspect the same workers, original GPS events, service lines, before/after/ruler photos, recorded/claimed hours and correction history. Original attendance and files are retained.

## Reports and downloads

Open Reports. Choose Work, Hours, Evidence or Issues, then dates, company, site, worker, service/sub-line and work status. Generate report. It uses all matching authorised database records, beyond the dashboard's loaded window. Subcontractors cannot export another company's records. Workers do not receive management export controls.

A report is an actor-bound snapshot lasting one hour. Editing live work afterwards does not change its saved rows. Changing access or expiring the report blocks further downloads. Generate another report when needed. Dates filter whole visits by Alaska service date, falling back to planned/created date; these are visit reports, not a midnight-to-midnight payroll allocation. A service filter finds matching visits; hours are not allocated across their service lines.

- CSV and real .xlsx Excel files contain EVERY matching row. Numbers stay numeric in Excel. CSV formula-like text is neutralised. No passwords or invitation/verification tokens are exported.
- The hours report separates recorded, claimed and NPI-approved hours, with unpaid breaks, first check-in/last checkout UTC, captured coordinates, accuracy and map links. Each worker's attendance is counted once despite several service lines. Unapproved hours remain empty rather than appearing accepted as zero.
- PDF summary includes totals across all matching rows and up to 200 detail rows. Long text may be shortened. Use CSV/Excel for complete details. The PDF shows the scope and snapshot time.
- Standard evidence reports contain metadata and authenticated work-record links, not permanent public image URLs. Select up to 20 evidence files to download unchanged originals in a private ZIP, up to 100 MB. Recheck access before download. Share that ZIP only with authorised people.

A single generation permits up to 100,000 result rows and a date range of at most 367 days. Larger requests fail clearly and are not silently truncated. Narrow the period when needed. Generation is limited to five reports per minute and ten active snapshots per administrator; reuse a recent snapshot or wait for expiry. A shared 50 MB snapshot-cache budget protects database storage; a request that exceeds it fails without a partial report. The existing minute dispatcher, or the next report generation, removes expired snapshots only; original work data is untouched. Browser/network failures retain a retryable report request; do not treat partial loading as a finished report.

## Spreadsheet and storage

Supabase stores primary records, managed identities and private originals/viewing copies. Cloudflare serves the frontend. Google Sheets mirrors management metadata and permitted planning proposals, not passwords or private photo bytes. People includes email and verification status. Settings shows the last successful workbook sync and a clear failure message when a refresh fails. Failed/unsent planning edits are not silently overwritten. There is no deletion of old tabs or operational records.

Two-way sync remains controlled: existing site name/address and unstarted planned date/equipment edits return as versioned proposals for NPI review. Hours, photos, role/approval changes and measurements use app workflows. This prevents spreadsheet edits from rewriting original attendance or granting access.

The app shell can reopen offline; attendance, uploads, registration and report generation need internet. Remembered sign-in is optional on personal devices, for up to seven days. Pending photos recover through account-scoped IndexedDB, up to 150 MB per account. Browser clearing/eviction can still lose local copies; the browser is not a backup. Device photos lets users resume or download originals; sign-out asks before removing pending local photos. Photo limits remain 20 MB each and twelve/60 MB per batch. Signed viewing links expire after one minute. Device labels, GPS and timestamps support human review, not forensic proof.

## Acceptance before live use

Keep your original NPI login. Invite a second NPI administrator with a real email; verify delivery, confirm pending access is blocked and approve as inviter. Invite a subcontractor administrator, verify and approve from NPI. Have that company invite a worker, verify and approve from the company. Test rejection, revocation, invitation replacement, private password recovery and company isolation with a second company.

Complete a worker-started visit using actual supported phone camera/GPS, before/ruler/after photos, below-two acknowledgement, both clock events and hours submission. Complete company and NPI reviews. Refresh Sheets and compare original events, service rows and separate hours.

Generate all four report types. Check CSV/Excel row counts beyond 500 records when enough data exists, verify PDF summary labelling and download selected private evidence. Check first/last GPS links. Confirm real issue/account emails and sync status. Local mocked tests do not certify your live email provider, Auth redirects, DNS or physical GPS accuracy.

## Reproduce tests

The source/ folder contains application modules, all tests/fixtures, migrations, package.json and the lockfile. From source/: npm ci, npm test, npx playwright install chromium, then npm run test:e2e. The system Chromium path is used on Linux where present; otherwise Playwright's installed browser is used. Tests use isolated PGlite and intercepted fictional cloud responses, never production secrets. See verification/ for scope/results and training/MEDIA-SOURCES.md for video reproduction and narration terms.
