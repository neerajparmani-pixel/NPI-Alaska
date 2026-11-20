# Alaska NPI Operations 3.1.0 — worker-led visits

## Open the package

Extract the entire ZIP and open START-HERE.html. It includes the three current demonstration videos, captions, written task instructions and audit reports. Keep this ZIP with your records. Deploy only the CONTENTS of frontend/ to your existing Cloudflare Pages project. The videos use fictional records and simulated GPS/camera; the 1.75-hour example is a test value, not filming duration. No real contract documents, rates, prices or credentials are included.

## Upgrade your existing installation

1. Keep your current Supabase project, management spreadsheet, npi-alaska Cloudflare Pages project and alaska.npi6030.com domain. Preserve your normal database/workbook backup. No DNS change is needed.
2. If migration 006 is already installed, run ONLY backend/supabase/007-v3-1-hardening.sql in the Supabase SQL Editor, once. If the project has only 001–004, apply 005, then 006, then 007. If 005 is installed, apply 006 then 007. Do not rerun earlier migrations. A failed migration rolls back; preserve the exact error before retrying. Existing accounts, assignments, attendance, original uploads and approvals are retained.
3. Replace your existing npi-admin Edge Function code with backend/supabase/npi-admin.ts and deploy. Keep Verify JWT with legacy secret OFF; caller identity and permissions are checked by the code/RPCs. Preserve SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NPI_ORIGIN, NPI_SHEETS_ID and NPI_SHEETS_TOKEN. Do not put server keys into frontend files or sheet cells.
4. Replace the existing spreadsheet-bound LiveSync.gs with backend/google-sheets/LiveSync.gs. Preserve NPI_SHEETS_TOKEN and NPI_MANAGER_EMAILS in Script Properties. Keep one onOpen implementation. Reload the workbook, then use NPI Operations → Refresh management workbook. It uses the same seven visible tabs.
5. Configure the email sender below. Use Enable automatic sync & emails once if its triggers are not already installed. It refreshes Sheets every five minutes and dispatches email every minute. Unsent spreadsheet planning edits stop refresh instead of being overwritten.
6. Upload the CONTENTS of frontend/ as a new deployment in your existing npi-alaska Cloudflare Pages project. Keep your existing custom domain. Open https://alaska.npi6030.com/live/ and reload online. Installed PWA users should reopen online, finish pending uploads, and select Update app when offered. Updates wait for saved forms and completed device queues. The frontend requires backend migration 007 and blocks incompatible workflows.
7. In NPI Settings configure contract line items and sub-line items. Existing approved company workers can then prepare their own visits. Run the live acceptance checks before using this for real shifts.

## Fresh installation only

Apply 001-foundation.sql and 002-live-access.sql to a new project. Create and confirm the initial owner in Supabase Authentication. Replace the owner email placeholder in 003-first-admin.sql and run it. Apply 004, 005, 006 and 007 in order. Set your project URL and publishable key in frontend/live/config.js. Configure the Edge Function, bound workbook ID/token and approved manager emails on both sides. Follow the remaining setup steps above. Never run this fresh-install sequence over an existing installation.

## One-time setup: NPI

Create the company, service categories, locations and main contract. Grant the subcontractor access to the appropriate contract/sites. Invite its administrator. The subcontractor invites and approves its own workers; NPI does not need to know or assign each worker individually.

In Settings → Contract line items & sub-line items, add a LINE ITEM for each worker-facing service. Select its contract, category and unit; give it a code and simple service name. Enable Require snow depth and ruler photo for snow-depth services. Enable Allow call-out location entry when appropriate.

Add SUB-LINE ITEMS beneath the correct parent. Selecting a parent fills its contract, category and unit. For snow bands enter an inclusive minimum and exclusive maximum: for example minimum 2/maximum 4 means two inches up to, but not including, four. Leave the maximum blank for the highest open-ended band. New snow parents start inactive/draft. The app creates Below 2 inches (minimum 0, maximum 2). Add the remaining contiguous bands through an open-ended highest band, then Activate the parent. Missing lowest coverage, overlaps and gaps block activation. Migration 007 leaves existing invalid snow parents inactive; inspect the catalogue and complete their bands before workers start new snow visits. Changes to active children cannot break coverage. Below 2 records are flagged for explicit acknowledgement at both reviews; they create no billing entitlement. A reading outside all configured bands must be reviewed with the administrator; the app does not invent a billable category. Non-snow services with sub-items require a manual detail selection.

Hierarchy and bounds are preserved after creation. Retire an incorrect item and create its replacement. Existing visit descriptions remain intact. This version records work, quantities and hours; billing, prices and invoices are excluded.

## Worker: short daily flow

Start work → Select site and service → Prepare visit → Before photos / snow measurement → GPS check-in → Record services → After photos / GPS checkout → Submit hours.

No daily assignment is required. Site choices come from company contract access. Suggest nearest site uses GPS only to suggest a configured site within one kilometre. Confirm the suggested site, or select manually. If location detection is unavailable, manual site selection remains available; actual attendance still requires fresh GPS. A manually entered address is never labelled as verified GPS.

Call-out services may include a location name/address without a request reference. The visit remains linked to its authorised contract/site scope and the entered location is visible for review. It does not create a new shared site or silently grant more contract access.

Expand Crew & equipment only when needed. Selected workers must be active approved workers of the same company. Crew members cannot have overlapping open attendance. A prepared visit can be resumed or cancelled; it is not deleted. Unstarted worker-led visits auto-cancel after 24 hours without saved server activity, on the next context/action/dispatcher check. Unsent device photos do not extend that window. Device photos still allows downloading pending originals. Worker-led drafts are excluded from unstarted-work overdue alerts. The service date is set at first server-received check-in in America/Anchorage and retained across midnight and daylight-saving changes. A site-level warning identifies other open visits so workers can check for duplicates without blocking legitimate separate crews.

Take several photos one at a time with Capture → Keep / Retake, or choose multiple files. Upload before starting. For a snow service, capture a fresh ruler photo directly with Take photo in the app, select it, enter inches and confirm the measurement. A ruler photo needs a capture timestamp, belongs to that visit/service, and cannot back another service. Ordinary evidence still accepts multiple chosen files. An uploaded file cannot substitute for camera ruler evidence. A newly added snow service requires fresh ruler evidence. The app selects the snow-band sub-line. Actual ruler content is reviewed by people; the database only enforces that evidence and a confirmed value exist.

Select Start work, capture a fresh position and record attendance. Add other services to the SAME visit; update each service quantity and mark it complete when finished. Do not repeat the attendance hours for each line. Unit-hour service quantities describe that service and do not create extra attendance time. After work, upload after photos, select Finish work and capture fresh checkout GPS. Record unpaid breaks. All crew members must check out before submission. Each worker submits their own hours; original recorded time is retained.

If a required measurement or evidence cannot be obtained safely, use Work outcome / problem completing and record an explicit missing-evidence reason. Choosing a partial outcome by itself does not bypass evidence. These records are exceptions requiring explicit acknowledgement at BOTH review stages. Do not fabricate photos, locations or completed services.

## Optional automatic ruler reading

Manual snow measurement is always available. Read photo automatically sends only the selected signed viewing photo to an optional configured vision service. Workers confirm or correct any suggestion. No automatic reading is saved as confirmed merely because the service returned a number. Poor, unclear, unavailable or rate-limited readings fall back to manual entry. Original evidence stays unchanged. Corrections to an existing measurement require a reason and retain a prior-value history entry.

To enable this option, the owner may add NPI_VISION_API_KEY as a Supabase Edge Function Secret for an OpenAI API project, then redeploy the included function. The included implementation uses gpt-4.1-mini. This optional service may incur provider charges and sends the selected viewing copy to that provider; decide whether it is appropriate for your evidence policy before enabling it. No API key is included or required for manual use. Never paste this secret into the app, spreadsheet or chat.

The server checks camera photo access and permits ten successful provider calls per worker per hour, thirty attempts per hour and two simultaneous requests. Failed HTTP/network calls release the successful-call reservation; a successful but unreadable provider response still counts. Stale reservations expire after 90 seconds. Automatic readings require human confirmation and can be wrong even with a high model confidence. Live model accuracy was not validated against physical snow rulers in the local audit.

## Subcontractor Admin: periodic review

Invite and approve workers once, then monitor worker-started visits as needed. No daily assignment is required. Open the review queue, inspect the crew, line/sub-line entries, quantities, ruler evidence, original GPS events and claimed hours. Review before/after pictures directly in the private gallery. Resolve issues with a meaningful explanation. Forward checked records to NPI, or return them with clear correction instructions.

## NPI Admin: periodic verification

View activity immediately as workers record it. Review only after company approval. Verify the same services, measurements, photos and attendance. Accept claimed hours or explain a correction. Incomplete work and missing-evidence exceptions remain visible and need explicit acknowledgement. Reports includes per-worker exception visit counts and percentages. These help review and are not automatic misconduct findings. Existing assigned records continue to use their original workflow.

Work search covers authorised records in pages of fifty and includes line/sub-line text. Dashboard/activity reports describe the latest 500 loaded work records rather than all-time totals. The selected visit loads its own service lines so older records can be inspected from search.

## Email and daily summary

Use a verified Resend sender. Keep NPI_EMAIL_API_KEY and NPI_EMAIL_FROM in Supabase Edge Function Secrets. Configure NPI recipients in NPI Settings; subcontractors configure their own separate recipients. The existing dispatcher requires the bound spreadsheet ID/token. Send test email queues a test; run npiDispatchEmails or wait for the trigger, check Email queue and the actual inbox/spam folder.

Issues create in-app notifications and configured email jobs for both administrators. Open apps check alerts every thirty seconds; there is no closed-app native push. Urgent escalation requires the dispatcher. Immediate danger requires direct emergency/supervisor contact.

Daily summaries are OFF by default. Migration 007 also turns existing scopes off; each administrator must opt in again. After 7 AM Alaska time the dispatcher queues one summary per scope/date/recipient: yesterday’s new/submitted visits and recorded worker-hours across submitted visits, plus current pending reviews and unresolved issues. These hours describe entire visits submitted yesterday, not a strict midnight-to-midnight labour ledger. Missed days are not backfilled. “Sent” means provider acceptance, not confirmed inbox delivery. No real email was sent during local tests.

## Seven tabs and controlled two-way sync

Overview, Work, Attendance, People, Setup, Issues, Evidence & history.

Work includes each visit, crew member, hour review and line/sub-line record. Setup includes the contract catalogue. Measurements, quantities, sub-line selection, original attendance and review history are mirrored as operational metadata. Hidden Source JSON preserves complete exported fields. Private image/PDF binaries remain in Supabase Storage; sign in to the app to view them. Passwords, invitation tokens, server keys and billing data are not exported.

Sheets → Supabase remains controlled: existing site name/address and UNSTARTED planned date/equipment edits become versioned proposals for NPI review. Worker hours, measurements, approvals, account permissions and evidence must use app workflows. Only trusted NPI management should access the workbook/bound script. Refresh refuses unsent edits and exports above 20,000 rows per table instead of silently truncating.

## Storage, PWA and limits

Supabase stores primary records, managed accounts and private original/viewing files. Cloudflare hosts the frontend. Install from the HTTPS site using Install app/Add to Home screen. The shell can reopen offline; attendance, uploads and mutations need an internet connection. Keep me signed in is optional, default off, and only for personal devices. It stores managed session tokens, never passwords, for up to seven days and coordinates refresh/sign-out across tabs where browser Web Locks are available. On shared devices leave it off. Pending prepared originals and viewing copies are stored in account-scoped IndexedDB, up to 150 MB per account. Saved on this device is distinct from saved to Supabase. Reloading restores pending items and stable upload identifiers; a conflict is verified against existing bytes before acknowledgement. Use Device photos to resume or download pending originals. Signing out asks to remove pending local copies. Unsupported/private browsers or full storage show an explicit warning and keep only memory copies. Browser storage may still be cleared or evicted; do not treat it as a backup. The cache contains only public app assets; decoder code loads on demand, private uploads and APIs are never cached by the service worker.

Common image formats and PDF timecards are supported: up to 20 MB each, twelve files/60 MB per batch. HEIC/TIFF viewing conversion is local; malformed or unsupported variants can fail. Device capture/preparation stamps and server upload time are labelled separately. GPS, camera source labels and timestamps are evidence for review, not forensic proof. Ruler record IDs are unique to services; the app does not prove that two separate captures show different physical snow or detect all visually duplicated images. No automatic deletion/retention purge is included. Check actual provider storage usage in its console; registered-byte summaries exclude some preview/unregistered storage.

## Live acceptance

Use one NPI account, two separate company accounts and workers. Confirm each company sees only its scope and workers. Configure one line with snow sub-lines and another service. Have a worker prepare a visit without an assignment, upload ruler/before photos, confirm inches, check in, add a service, mark completed work, upload after photos, check out and submit. Complete both approval stages. Verify hours are counted once per worker.

Test wrong-company access, overlapping check-in rejection, correction reasons, missing-evidence exceptions, private photo access and actual camera/GPS on supported phones. Confirm issue email and daily-summary delivery after sender/trigger setup. Refresh the seven-tab workbook and submit/review one permitted planning edit. Local tests do not establish that the production cloud setup has been upgraded successfully.

## v3.1.0 release checks and source

The verification folder contains the audit scope, test counts and remaining live acceptance requirements. The source/ folder includes test sources, fixtures, application modules and package-lock.json. From source/: run npm ci, npm test and npx playwright install chromium, then npm run test:e2e. Test fixtures intercept cloud responses; database tests execute migrations in isolated PGlite. They do not write to your live project. Chromium is auto-detected on Linux or uses the Playwright browser.

Invitation preview/registration use installation-wide and hashed-invitation minute limits, return 429 on excess, and use generic registration conflicts. Server faults return 5xx with a request ID and sanitized server logs. No untrusted client IP is treated as authenticated identity. For a large public launch, add provider/WAF abuse controls separately. The bound Sheet requires an individually owned workbook; Shared Drive workbooks without getOwner() fail with a clear instruction instead of silently weakening manager authorization.

Before replacing the production frontend, stage the upgrade and test a below-two-inch visit, normal visit, explicit evidence exception, camera ruler reuse rejection, reload/retry recovery, cross-account isolation, midnight/overnight work and a controlled Sheet proposal. Verify actual email delivery, seven-tab refresh and both administrative approvals. Keep the frontend/function versions aligned with migration 007. Billing remains excluded.
