# Alaska NPI Operations 1.0 — complete package

This release follows the agreed workflow: NPI owns the customer contract and oversight; the subcontractor owns its team and daily assignments. Exactly three roles: NPI Admin, Subcontractor Admin and Worker. Billing, rates and invoices are not part of this release. No private contracts, prices, workers or work records are preloaded.

Your approved navy sidebar, gold-edged overview, transparent emblem, Source Sans 3 type, four supplied site photos and responsive phone layouts are retained. This package contains frontend source, the complete Edge Function, all SQL for your records, the management workbook code and verification notes.

## Upgrade your existing installation — four steps

Your current domain, owner account, companies, records and spreadsheet remain. **Do not rerun 001, 002 or 003, recreate the owner, or change DNS.**

1. **Database:** Supabase → SQL Editor → New query. Paste all of `backend/supabase/004-operations-invitations.sql` and Run once. It must complete without errors. It adds invitations, account approval and contract/site responsibilities; existing records are preserved.
2. **Account service:** Supabase → Edge Functions → npi-admin → Code. Replace the entire editor file with `backend/supabase/npi-admin.ts`, then deploy. Keep **Verify JWT with legacy secret OFF**: public invitation requests are checked by token inside the function; management actions use Auth/database permissions. Keep your existing NPI_SHEETS_TOKEN and NPI_SHEETS_ID secrets unchanged. Supabase supplies its own server credentials automatically; no new secret key needs to be copied into the frontend.
3. **Workbook:** In your existing spreadsheet → Extensions → Apps Script, replace the contents of **LiveSync.gs** with `backend/google-sheets/LiveSync.gs` and save. Keep existing Script Properties and other existing code. Run **npiPullLive** as the workbook owner and reload the workbook. Use the Live_ tabs. Contracts and site responsibilities are readable; only yellow location/planning fields can be proposed for review. Do not rerun npiCreateSyncToken: your existing bridge token remains valid. Older tabs, including any previous finance tabs, are not deleted; hide them if not needed. Preserve any unsent edits before updating. Finance tabs are excluded from this release's default refreshed table list.
4. **App:** Extract the ZIP. Cloudflare → Workers & Pages → **npi-alaska** → Create deployment → Production. Upload the **contents of the frontend folder**, so `index.html`, `_headers`, `_redirects`, `live/`, `three-view/` and `icons/` are at the upload root. Deploy. Keep `alaska.npi6030.com` and its DNS unchanged. Open **https://alaska.npi6030.com/live/** online, hard-refresh with Ctrl+Shift+R if needed, and sign in using your existing owner email/password.

This is a code package, not an automatic cloud installation. Dashboard access is yours; no SQL, Edge Function, Apps Script or Cloudflare deployment has been applied to your accounts by downloading it. Install all four parts before using invitations; the old Edge Function cannot handle the new signup flow.

## First real company — NPI's setup

1. **Subcontractors → Add company:** enter the subcontractor name, for example Whitter. No worker names are needed.
2. **Sites & locations → Add location:** enter each actual site, verified address and matching photo. The four supplied building photos are selectable; they are reference pictures, not proof that work occurred.
3. **Settings → Services:** add your service types, for example plowing, sanding and hauling. The company administrator will provide specific instructions and checklists on each assignment.
4. **Contracts & sites → Add contract:** enter a name, customer/main source and optional reference. Contract files, clauses, prices and invoices are not requested.
5. **Contracts & sites → Assign site to subcontractor:** choose the contract, company and site. Repeat for its other sites. Each future contract/company gets its own responsibilities.
6. **People & access → Invite subcontractor admin:** choose the company and create the link. Copy and share the link privately. The link is shown once, works for one registration and expires in seven days. You can disable it from the invitation register. A lost link can be replaced with a new invitation; disable the old one.

## Subcontractor administrator

1. Open the NPI invitation, enter your own full name, username and password, then sign in. The invitation fixes the company and administrator role; you cannot choose either.
2. **My team → Invite workers:** create and share your company's worker signup link. It expires after seven days and permits up to 100 registrations. Disable or replace it when no longer needed.
3. Workers register their own names, usernames and passwords. **Pending workers → Approve worker** grants access. Reject unfamiliar registrations. Account approval never approves work hours.
4. **My subcontract:** check the contract/site responsibilities NPI assigned to your company.
5. **Work orders → New assignment:** choose a contract/site, service, date, equipment, workers and checklist. Only active, approved workers from your own company can be assigned. NPI must first give your company its contract/site responsibilities.
6. Review completed work and evidence, then **Approve & forward to NPI** or request a correction.

## Worker

1. Open your company's signup link, enter your name and choose a username/password. Usernames are unique across the app; use a company prefix if yours is already taken. No email inbox is required. Passwords must meet your Supabase project's policy and this app's minimum 12-character / maximum 72-byte rule.
2. Await your company's approval. You may sign in to check approval, but cannot access work until approved.
3. Open **My work → View assignment**. Capture a fresh location and record check-in. With an individual or explicit crew entry, the app records who captured each event.
4. Complete tasks and upload actual work photo evidence. Hauling assignments additionally require whole loads and a timecard.
5. Capture a separate fresh checkout location, record any unpaid break and submit your claimed hours. Original recorded time stays separate from your claim. All assigned workers must be checked out before claims are submitted.
6. **My hours** shows recorded, claimed and NPI-accepted hours. If your company returns work, follow the correction note and resubmit through the same review process.

## NPI verification

NPI can inspect each work record's worker/company/site, both immutable GPS points and device/server times, map links, uploaded photos, tasks, claimed hours and company review. Open a work-photo button to see the private image, or its original file. Verify against attendance and accept the hours or return to the subcontractor. Corrections are separate from the original evidence. Refresh the management workbook to see current records and decisions. The workbook does not grant company/worker access and cannot overwrite original attendance or bypass approvals.

## Fresh installation only

If the project has never been set up: create a Supabase project and a private Google management workbook first, and update the public configuration/project/workbook references for that environment. In Supabase run 001-foundation.sql then 002-live-access.sql. Create and confirm the first owner Auth user, put the actual owner email into 003-first-admin.sql and run it. Then run 004-operations-invitations.sql. Keep the Email provider enabled and public self-signup disabled; invitations use the trusted server enrollment service.

Deploy npi-admin.ts as npi-admin with legacy JWT verification off. In the bound Apps Script project paste LiveSync.gs, run npiCreateSyncToken once, copy the generated NPI_SHEETS_TOKEN from Script Properties privately into Supabase Edge Function Secrets, and also set NPI_SHEETS_ID to the workbook ID. Never put service-role keys, passwords or tokens in spreadsheet cells or chat. Run npiPullLive and authorize the owner execution. Deploy the frontend and verify it before inviting staff.

The included public configuration is already set to the project/workbook supplied in this conversation. It contains a browser-safe publishable key, not a server secret.

## Before staff use it

Test one company administrator invitation, worker signup and pending approval, company-owned assignment, fresh GPS at both ends, task/photo completion, company review, NPI verification and workbook refresh. Test another company's account cannot read that work or private evidence. Expired, disabled and consumed admin links must fail. Do this on your actual HTTPS deployment; local tests are not evidence of your cloud installation.

## Limits and recovery

- Sessions stay in memory; refreshing the page requires signing in again. Saved cloud records remain. Unsaved in-page form drafts can recover after same-user reauthentication; passwords/files/GPS must be entered again.
- Public signup links are credentials. They are sent as URL fragments and removed from the address bar/current history entry when opened. Reopening a refreshed registration page requires the original invitation link. Passwords and plaintext invite tokens are not saved in application tables or spreadsheet cells.
- If registration times out, retry the same form or try signing in. An in-progress request may need up to 90 seconds before retry. Server reservations and Auth metadata recover uncertain account creation without creating a second identity. If a link is revoked or expires during a failed creation, ask the owner for help; an inaccessible Auth identity may need owner recovery. No incomplete identity gets work access.
- GPS is device-reported and requires permission and an online connection; it is not a guarantee of physical presence. The reviewer sees accuracy and both original points. Original evidence cannot be edited/deleted by browser clients.
- Work lists load up to 500 per selected workflow, with direct detail lookup. Admin context lists up to 500 contracts, 2,000 responsibilities and 100 recent invitation links; profiles are capped at 1,000 and workbook exports at 20,000 per table. Larger operations need additional pagination/reporting.
- Workbook synchronization is controlled: Refresh pulls records, Submit proposes permitted edits, NPI reviews them. It is not instant two-way editing. Original attendance and account permissions are protected.
- Work evidence is in the private Supabase work-evidence bucket (up to 8 MB per file). Database records are in Supabase; the workbook is a management view. Offline writes are blocked, not queued. No automatic emails, SMS, billing, invoices, rates or payments are included in this release. Legacy finance tables/data are retained for compatibility but are not an operational feature here.
