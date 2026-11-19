# Alaska NPI Operations 2.0 — complete setup and operating guide

## What is in this package

The real three-role PWA frontend, Supabase migrations and Edge Function, compact Google management workbook script, three narrated screen recordings, task instructions, audit evidence and release manifest. The app uses your Supabase project; it has no demo role picker or seeded operational records. Training videos use fictional intercepted records, a synthetic camera feed and simulated GPS, visibly labelled. They do not demonstrate your production configuration.

Keep a copy of the ZIP with your records. Extract the ZIP completely. Open START-HERE.html for setup and training. Deploy only the contents of frontend/ to Cloudflare Pages; do not upload this entire release ZIP as the website.

## Existing installation: upgrade in this order

1. Preserve your usual database/workbook backup. Keep your current Cloudflare project, custom domain, Supabase project and management spreadsheet. No DNS change is needed for alaska.npi6030.com.
2. In the Supabase SQL Editor, run backend/supabase/005-field-operations.sql ONCE after your existing migration004. Do not rerun001/002/003/004. If005 was already applied successfully, stop rather than running it twice. Original attendance, existing evidence and approved work are preserved. Legacy records retain an unknown creator/time instead of invented attribution.
3. Replace the code of your existing npi-admin Edge Function with backend/supabase/npi-admin.ts and deploy. Keep Verify JWT with legacy secret OFF: this function validates caller access itself. Preserve existing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NPI_ORIGIN, NPI_SHEETS_ID and NPI_SHEETS_TOKEN settings. NPI_ORIGIN is https://alaska.npi6030.com; NPI_SHEETS_ID is your existing spreadsheet ID. Never put a service-role key into the frontend or workbook.
4. Replace the existing LiveSync.gs in the spreadsheet-bound Apps Script project with backend/google-sheets/LiveSync.gs. Preserve the existing NPI_SHEETS_TOKEN Script Property and approved NPI_MANAGER_EMAILS. Keep only one onOpen implementation in that Apps Script project. Reload the spreadsheet to see the NPI Operations menu.
5. Use NPI Operations → Refresh management workbook. It creates seven organised tabs. Submit unsent planning edits before refreshing. Use Hide legacy tabs only after checking the new workbook; it hides other tabs and never deletes their data. You may unhide them later in Google Sheets.
6. Configure email delivery using the section below, then use Enable automatic sync & emails once. Authorise the requested Google permissions. This installs one five-minute refresh trigger and one one-minute dispatcher trigger; the function replaces only its own earlier triggers. Automatic refresh stops rather than overwriting unsent edits.
7. Deploy the CONTENTS of frontend/ to the existing npi-alaska Cloudflare Pages project. Keep the existing alaska.npi6030.com custom domain. Open https://alaska.npi6030.com/live/, reload, and sign in. Installed PWA users should reopen online so the updated shell can load. Reload ends the current in-memory session, so sign in again.
8. Run the live acceptance checklist below with separate test accounts before using the release for real shifts. Local automated tests are not proof that your cloud setup has been upgraded.

## Fresh installation only

Create a Supabase project and use001-foundation.sql, then002-live-access.sql. Create and confirm the initial owner in Authentication. Replace the email placeholder in003-first-admin.sql with that confirmed owner email, then run003. Apply004 and005 in order. Set the project URL and publishable key in frontend/live/config.js. Deploy npi-admin and configure the bound workbook and its existing ID/token on both sides. Public workers must use company invitations; do not enable unrestricted app enrolment. Follow the remaining setup and acceptance steps above. Do not run the fresh-install scripts over an existing installation.

## Email sender configuration

1. Create an account with Resend, the email provider used by the included dispatcher. Verify an appropriate sender domain or subdomain you control. Follow the exact DNS records supplied by the provider in Cloudflare DNS; the domain already uses Cloudflare nameservers. Preserve existing mail and DNS records. A dedicated notification subdomain can keep this separate from other NPI mail.
2. Create a sending API key. Add NPI_EMAIL_API_KEY to Supabase Edge Function Secrets. Add NPI_EMAIL_FROM using a sender on the VERIFIED domain, for example Alaska NPI <alerts@your-verified-notification-domain>. These are server settings, never browser or spreadsheet cells. No real key is included in this package.
3. NPI Admin opens Settings → Edit recipient emails and saves NPI recipients. Each Subcontractor Admin does the same for their company's recipients. Up to ten recipients per organisation are supported. These lists remain separate; workers cannot read or change them.
4. Use Send test email. This QUEUES a test. Run the Apps Script npiDispatchEmails function once, or wait for the configured one-minute trigger. In Settings → Email queue, confirm that the provider accepted the message. Check the recipient inbox/spam folder separately. Sent to provider does not guarantee inbox delivery.
5. If the queue stays queued, check that the trigger is installed, execution permissions remain valid, sender secrets are configured, the sender domain is verified, and the bound workbook token/ID matches the Edge Function. Inspect Apps Script Executions and Edge Function logs. Errors are recorded without exposing the provider key.

Issue reports create in-app notifications immediately after the database transaction. An open, visible app checks for new alerts every thirty seconds without replacing forms or uploads; use Refresh for an immediate full update. This is foreground polling, not native push delivery when the app is closed. Email usually follows at the next scheduled dispatcher run; it is not a guaranteed real-time channel. Urgent escalation also depends on that dispatcher. The durable outbox uses stable provider idempotency keys, bounded retries and a twelve-hour send window. Failed/uncertain jobs require operator review before a deliberate resend. A dispatcher outage must not be treated as evidence that an issue was acknowledged. Immediate danger requires a direct emergency/supervisor call.

## The seven spreadsheet tabs

- Overview: refresh time, counts and instructions.
- Work: assignments, assigned workers and hour reviews, distinguished by Record type.
- Attendance: original check-in/out events and captured positions.
- People: approved, pending and paused company accounts; no passwords.
- Setup: companies, contracts, site responsibilities, sites, service requirements, invitation expiry/revocation metadata and recipient configuration.
- Issues: reports, status, ownership, resolution and comments.
- Evidence & history: file metadata, work changes, audit events, in-app notices, email status and spreadsheet proposals.

Source JSON and versions are hidden technical columns used for safe comparisons. IDs are hidden to keep the visible workbook readable. Do not edit hidden metadata. All operational record fields are mirrored; private image/PDF binaries remain in Supabase Storage. Open the work link and sign in to view pictures. Passwords, invitation tokens, API secrets, command bodies and deferred billing data are not exported.

## Two-way sync: what can be changed

Supabase → Sheets mirrors authorised management records. Sheets → Supabase supports EXISTING site name/address and UNSTARTED assignment planned date/equipment. Only clearly labelled editable cells are intended for these edits. Use Submit planning edits for NPI review, then NPI checks and accepts or rejects in Spreadsheet review inside the app. Expected-version checks reject stale edits. Five-minute refresh subsequently shows accepted changes.

Share the workbook and its bound Apps Script only with trusted NPI management. Spreadsheet protections are editing aids, not a substitute for server permission checks. Workers and subcontractors should use the app instead.

This is controlled bidirectional sync, not unrestricted overwriting. Attendance, photo originals, hours, company membership, permissions, issue history and approvals must be changed only through their app workflows. Creating accounts, new work, resolving issues and configuring evidence rules are app tasks. The spreadsheet is an organised management table view, not a copy of the PWA interface.

## NPI Admin: setup and daily tasks

Add companies, locations and services. Create the main contract and assign the permitted sites to the subcontractor. Invite the company administrator with the single-use, seven-day link. The administrator registers their own credentials and invites their workers.

Use Work orders to filter by contract, company, site, worker, date, status or search text. Search is server-paginated at fifty assignments per page. Every assignment shows its creator, time where known and team. Open it to inspect individual recorded/claimed/accepted hours, GPS events, checklist, photos, issue history and assignment changes.

In Settings, configure before/after requirements per service for NEW assignments. Locations supports verified addresses, access/hazard instructions and optional site coordinates/radius. A GPS flag requests investigation; it is not an automatic rejection. Existing work keeps its original evidence policy snapshot.

Review only after the company forwards the work. Compare originals and inspect evidence, then accept or return with a reason. Partial/unable work or a missing-evidence exception requires explicit acknowledgement by both review stages. Acceptance of hours does not turn a partial job into a completed service; its outcome and explanation remain visible.

Activity reports filter/export the currently loaded snapshot, up to the latest500 permitted assignments and bounded associated events. They are not all-time totals. Use the paginated Work orders search to locate older records, or the paginated management workbook export for broader reporting. Workbook refresh refuses exports above20,000 rows per table instead of silently truncating them.

## Subcontractor Admin: company-owned scheduling

Register from NPI's administrator invitation. Invite workers from My team. Verify and approve each registration before assigning work. Worker links expire after seven days and permit up to100 registrations. Disable unused links. Reset passwords privately; pause access without deleting work history.

Create an assignment using a permitted contract/site and an active service. Enter the specific area, instructions, date, equipment, approved company workers and checklist. Repeat assignment creates up to twelve copies with the same approved team; choose dates and intervals carefully. Unstarted team changes require a reason. Once attendance starts, preserve the original team and create a separate job for additional workers. Only unstarted work can be cancelled.

Monitor progress, acknowledge issues, assign an administrator, comment and record a meaningful resolution. Inspect each worker's claim, GPS and evidence before approving and forwarding to NPI. Return incomplete information with clear instructions. Configure company email recipients in Settings and check queue status.

## Worker: one clear shift flow

Open your company's invitation, register your own details and wait for approval. My work shows assigned jobs. Check the site photo/address, exact area, team and hazards. Use Start/check-in to capture fresh GPS; select the correct assigned crew and save.

Add Before work photos. Use Take photo → Capture → Keep or Retake → take another. Review thumbnails, then upload. Alternatively choose multiple files. Update tasks as work is completed; hauling also needs whole loads and a timecard. Report problems with urgency, description and optional linked issue evidence. Add After work photos, capture fresh checkout GPS, enter unpaid breaks and submit hours. All assigned crew members must check out before submission.

Normal claims use exact recorded time, even when the display is rounded. If actual worked time differs, enter a claim and reason; original events remain unchanged. My hours shows recorded, claimed and accepted values. Company review comes first, then NPI verification. Follow any returned correction instructions and resubmit.

## Photos, file formats and recovery

Take several pictures directly in the app, one at a time. Keep/retake each image, then upload a batch. Choose Before, Progress, After, Issue or Timecard. Link issue evidence to its report. Supported common formats: JPG/JPEG, PNG, WebP, HEIC/HEIF, TIFF, GIF, BMP and AVIF; PDF is accepted for timecards/documents. Some malformed, newer or unusual variants may not decode; the app must report failure instead of claiming upload success. Multipage/animated formats use a single viewing frame; the original remains available.

Limits are20MB per file and twelve files/60MB per batch. HEIC/HEIF and TIFF are converted for viewing; originals are preserved unchanged. A stamped JPEG shows the site, worker, category and device-reported capture or preparation time. A selected file is NOT claimed to have been captured at upload time. Gallery metadata separately shows server-recorded upload time. Device stamps and metadata are not forensic proof of place/time.

The queue shows Waiting, Uploading, Saved or Failed. Retry skips successful items. Keep the tab open until every file is saved. Files are held in memory only: closing/reloading loses unsaved files. After session expiry, signing into the SAME account can restore the in-memory queue; a different account cannot receive it. Camera access is requested only when used and stops when the capture/upload dialog closes.

## Exceptions and corrections

If work is partial or impossible, select Work outcome and explain why. If required pictures/evidence are unavailable, record a missing-evidence reason there. This does not silently waive the rules: both administrators must explicitly acknowledge the exception before approval. Do not fabricate photos or mark tasks that were not done.

For a missed checkout, contact the company administrator, record the real fresh checkout event and explain a corrected claim for the actual working period. Do not backdate device events or edit original attendance in Sheets. GPS far from the configured site, poor accuracy, long open shifts, differing claims and overdue unstarted work are review flags. Existing SQL prevents new overlapping open attendance.

## Storage, privacy and PWA use

Supabase is the primary database, identity service and PRIVATE evidence store. Cloudflare hosts the frontend. Sheets mirrors operational metadata and controlled planning proposals. The Settings storage figure describes registered original-file volume in the permitted scope; previews and abandoned/unregistered objects also consume storage. Check the provider console for actual quota usage.

No automatic deletion or retention purge is included. Agree a retention policy before adding destructive maintenance. Private signed evidence links expire after a minute and are not public share links. Sign out on shared devices. Secrets never belong in browser files, spreadsheet cells or training recordings.

Install from the deployed HTTPS site using browser Install app/Add to Home screen; on iPhone use Share → Add to Home Screen. Camera and precise location require browser permission and internet. The shell can reopen offline, but this release has no offline attendance/write queue and does not guarantee durable offline photo storage. Reload requires sign-in again; saved cloud records remain.

## Live acceptance checklist

Use one NPI account, two separate company accounts and workers in each company. Verify company isolation, invitation expiry/revocation and pending approval. Create a real test assignment; capture separate GPS at both ends, take multiple before/after photos and upload them. Confirm management opens the same photos and unchanged originals. Report an issue; check both organisations' in-app notices and actual test inbox delivery after sender configuration. Resolve the issue and inspect the reporter view.

Complete company approval and NPI verification. Test a returned correction and a missing-evidence/partial-work exception. Confirm role access for private files and that a different company cannot read the record. Refresh the workbook, change an editable plan field, submit/review it and confirm the accepted value syncs back. Confirm original attendance cannot be changed through the workbook. Check trigger executions and retry/error visibility.

The release audit documents local test evidence. Production sender credentials, real device GPS accuracy, actual private storage policies and Google trigger execution must be verified in your environment before operational rollout. Billing, prices, invoices and payments remain deferred.
