# Alaska NPI Operations 3.0 — worker-led visits

## Open the package

Extract the entire ZIP and open START-HERE.html. It includes the three current demonstration videos, captions, written task instructions and audit reports. Keep this ZIP with your records. Deploy only the CONTENTS of frontend/ to your existing Cloudflare Pages project. The videos use fictional records and simulated GPS/camera; the 1.75-hour example is a test value, not filming duration. No real contract documents, rates, prices or credentials are included.

## Upgrade your existing installation

1. Keep your current Supabase project, management spreadsheet, npi-alaska Cloudflare Pages project and alaska.npi6030.com domain. Preserve your normal database/workbook backup. No DNS change is needed.
2. If Operations 2 migration005 was applied successfully, run ONLY backend/supabase/006-worker-led-visits.sql in the Supabase SQL Editor, once. If your project has only001–004, apply005 first, then006. Do not rerun earlier migrations. Existing accounts, assignments, attendance, original uploads and approvals are retained.
3. Replace your existing npi-admin Edge Function code with backend/supabase/npi-admin.ts and deploy. Keep Verify JWT with legacy secret OFF; caller identity and permissions are checked by the code/RPCs. Preserve SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NPI_ORIGIN, NPI_SHEETS_ID and NPI_SHEETS_TOKEN. Do not put server keys into frontend files or sheet cells.
4. Replace the existing spreadsheet-bound LiveSync.gs with backend/google-sheets/LiveSync.gs. Preserve NPI_SHEETS_TOKEN and NPI_MANAGER_EMAILS in Script Properties. Keep one onOpen implementation. Reload the workbook, then use NPI Operations → Refresh management workbook. It uses the same seven visible tabs.
5. Configure the email sender below. Use Enable automatic sync & emails once if its triggers are not already installed. It refreshes Sheets every five minutes and dispatches email every minute. Unsent spreadsheet planning edits stop refresh instead of being overwritten.
6. Upload the CONTENTS of frontend/ as a new deployment in your existing npi-alaska Cloudflare Pages project. Keep your existing custom domain. Open https://alaska.npi6030.com/live/ and reload online. Installed PWA users should reopen online to obtain the new shell and sign in again.
7. In NPI Settings configure contract line items and sub-line items. Existing approved company workers can then prepare their own visits. Run the live acceptance checks before using this for real shifts.

## Fresh installation only

Apply001-foundation.sql and002-live-access.sql to a new project. Create and confirm the initial owner in Supabase Authentication. Replace the owner email placeholder in003-first-admin.sql and run it. Apply004,005 and006 in order. Set your project URL and publishable key in frontend/live/config.js. Configure the Edge Function, bound workbook ID/token and approved manager emails on both sides. Follow the remaining setup steps above. Never run this fresh-install sequence over an existing installation.

## One-time setup: NPI

Create the company, service categories, locations and main contract. Grant the subcontractor access to the appropriate contract/sites. Invite its administrator. The subcontractor invites and approves its own workers; NPI does not need to know or assign each worker individually.

In Settings → Contract line items & sub-line items, add a LINE ITEM for each worker-facing service. Select its contract, category and unit; give it a code and simple service name. Enable Require snow depth and ruler photo for snow-depth services. Enable Allow call-out location entry when appropriate.

Add SUB-LINE ITEMS beneath the correct parent. Selecting a parent fills its contract, category and unit. For snow bands enter an inclusive minimum and exclusive maximum: for example minimum2/maximum4 means two inches up to, but not including, four. Leave the maximum blank for the highest open-ended band. Active snow bands must not overlap. A reading outside all configured bands must be reviewed with the administrator; the app does not invent a billable category. Non-snow services with sub-items require a manual detail selection.

Hierarchy and bounds are preserved after creation. Retire an incorrect item and create its replacement. Existing visit descriptions remain intact. This version records work, quantities and hours; billing, prices and invoices are excluded.

## Worker: short daily flow

Start work → Select site and service → Prepare visit → Before photos / snow measurement → GPS check-in → Record services → After photos / GPS checkout → Submit hours.

No daily assignment is required. Site choices come from company contract access. Suggest nearest site uses GPS only to suggest a configured site within one kilometre. Confirm the suggested site, or select manually. If location detection is unavailable, manual site selection remains available; actual attendance still requires fresh GPS. A manually entered address is never labelled as verified GPS.

Call-out services may include a location name/address without a request reference. The visit remains linked to its authorised contract/site scope and the entered location is visible for review. It does not create a new shared site or silently grant more contract access.

Expand Crew & equipment only when needed. Selected workers must be active approved workers of the same company. Crew members cannot have overlapping open attendance. A prepared visit can be resumed or cancelled; it is not deleted. A site-level warning identifies other open visits so workers can check for duplicates without blocking legitimate separate crews.

Take several photos one at a time with Capture → Keep / Retake, or choose multiple files. Upload before starting. For a snow service, select the ruler photo, enter inches and confirm the measurement. The app selects the snow-band sub-line. Actual ruler content is reviewed by people; the database only enforces that evidence and a confirmed value exist.

Select Start work, capture a fresh position and record attendance. Add other services to the SAME visit; update each service quantity and mark it complete when finished. Do not repeat the attendance hours for each line. Unit-hour service quantities describe that service and do not create extra attendance time. After work, upload after photos, select Finish work and capture fresh checkout GPS. Record unpaid breaks. All crew members must check out before submission. Each worker submits their own hours; original recorded time is retained.

If a required measurement or evidence cannot be obtained safely, use Work outcome / problem completing and record a clear reason. These records are exceptions requiring explicit acknowledgement at BOTH review stages. Do not fabricate photos, locations or completed services.

## Optional automatic ruler reading

Manual snow measurement is always available. Read photo automatically sends only the selected signed viewing photo to an optional configured vision service. Workers confirm or correct any suggestion. No automatic reading is saved as confirmed merely because the service returned a number. Poor, unclear, unavailable or rate-limited readings fall back to manual entry. Original evidence stays unchanged. Corrections to an existing measurement require a reason and retain a prior-value history entry.

To enable this option, the owner may add NPI_VISION_API_KEY as a Supabase Edge Function Secret for an OpenAI API project, then redeploy the included function. The included implementation uses gpt-4.1-mini. This optional service may incur provider charges and sends the selected viewing copy to that provider; decide whether it is appropriate for your evidence policy before enabling it. No API key is included or required for manual use. Never paste this secret into the app, spreadsheet or chat.

The server checks photo access and permits at most ten automatic-reading requests per worker per hour. Automatic readings require human confirmation and can be wrong even with a high model confidence. Live model accuracy was not validated against physical snow rulers in the local audit.

## Subcontractor Admin: periodic review

Invite and approve workers once, then monitor worker-started visits as needed. No daily assignment is required. Open the review queue, inspect the crew, line/sub-line entries, quantities, ruler evidence, original GPS events and claimed hours. Review before/after pictures directly in the private gallery. Resolve issues with a meaningful explanation. Forward checked records to NPI, or return them with clear correction instructions.

## NPI Admin: periodic verification

View activity immediately as workers record it. Review only after company approval. Verify the same services, measurements, photos and attendance. Accept claimed hours or explain a correction. Incomplete work and missing-evidence exceptions remain visible and need explicit acknowledgement. Existing assigned records continue to use their original workflow.

Work search covers authorised records in pages of fifty and includes line/sub-line text. Dashboard/activity reports describe the latest500 loaded work records rather than all-time totals. The selected visit loads its own service lines so older records can be inspected from search.

## Email and daily summary

Use a verified Resend sender. Keep NPI_EMAIL_API_KEY and NPI_EMAIL_FROM in Supabase Edge Function Secrets. Configure NPI recipients in NPI Settings; subcontractors configure their own separate recipients. The existing dispatcher requires the bound spreadsheet ID/token. Send test email queues a test; run npiDispatchEmails or wait for the trigger, check Email queue and the actual inbox/spam folder.

Issues create in-app notifications and configured email jobs for both administrators. Open apps check alerts every thirty seconds; there is no closed-app native push. Urgent escalation requires the dispatcher. Immediate danger requires direct emergency/supervisor contact.

Daily operations summaries are enabled in recipient settings and can be switched off there. After7AM Alaska time the dispatcher queues one summary per scope/date/recipient: yesterday’s new/submitted visits and recorded worker-hours across submitted visits, plus current pending reviews and unresolved issues. These hours describe entire visits submitted yesterday, not a strict midnight-to-midnight labour ledger. Missed days are not backfilled. “Sent” means provider acceptance, not confirmed inbox delivery. No real email was sent during local tests.

## Seven tabs and controlled two-way sync

Overview, Work, Attendance, People, Setup, Issues, Evidence & history.

Work includes each visit, crew member, hour review and line/sub-line record. Setup includes the contract catalogue. Measurements, quantities, sub-line selection, original attendance and review history are mirrored as operational metadata. Hidden Source JSON preserves complete exported fields. Private image/PDF binaries remain in Supabase Storage; sign in to the app to view them. Passwords, invitation tokens, server keys and billing data are not exported.

Sheets → Supabase remains controlled: existing site name/address and UNSTARTED planned date/equipment edits become versioned proposals for NPI review. Worker hours, measurements, approvals, account permissions and evidence must use app workflows. Only trusted NPI management should access the workbook/bound script. Refresh refuses unsent edits and exports above20,000 rows per table instead of silently truncating.

## Storage, PWA and limits

Supabase stores primary records, managed accounts and private original/viewing files. Cloudflare hosts the frontend. Install from the HTTPS site using Install app/Add to Home screen. The shell can reopen offline; attendance, uploads and mutations need an internet connection. Unsaved photo queues are memory-only and can be lost on reload/close. Same-account session recovery may restore an in-memory queue; a different account cannot receive it.

Common image formats and PDF timecards are supported: up to20MB each, twelve files/60MB per batch. HEIC/TIFF viewing conversion is local; malformed or unsupported variants can fail. Device capture/preparation stamps and server upload time are labelled separately. GPS and timestamps are evidence for review, not forensic proof. No automatic deletion/retention purge is included. Check actual provider storage usage in its console; registered-byte summaries exclude some preview/unregistered storage.

## Live acceptance

Use one NPI account, two separate company accounts and workers. Confirm each company sees only its scope and workers. Configure one line with snow sub-lines and another service. Have a worker prepare a visit without an assignment, upload ruler/before photos, confirm inches, check in, add a service, mark completed work, upload after photos, check out and submit. Complete both approval stages. Verify hours are counted once per worker.

Test wrong-company access, overlapping check-in rejection, correction reasons, missing-evidence exceptions, private photo access and actual camera/GPS on supported phones. Confirm issue email and daily-summary delivery after sender/trigger setup. Refresh the seven-tab workbook and submit/review one permitted planning edit. Local tests do not establish that the production cloud setup has been upgraded successfully.
