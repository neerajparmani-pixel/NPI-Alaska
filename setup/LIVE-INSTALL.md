# Connect the existing Alaska NPI deployment

This installer is configured for:

- App: **https://alaska.npi6030.com**
- Supabase project: **fyfjsqhnxcktjdihcaks**
- Workbook: **1FJkmwHbZaNLwT4awsSshJpysi95dwBtOOKadig_Ibz8**

The publishable key is already in live/config.js. It is browser-safe. No secret/service-role key, owner password or workbook bridge secret is in the ZIP. Do not paste any of those into chat, frontend files or worksheet cells.

This build uses real authenticated Supabase calls and starts with your real database records, not demo data. It cannot work until the new migration and first account are installed. The code has been tested locally, but your cloud deployment could not be accessed through this session's network proxy. Do not treat local tests as a successful live deployment.

## 1. Install the live database migration

You already ran 001-foundation.sql. **Do not rerun it.**

1. Open your Supabase project → SQL Editor → New query.
2. Open the ZIP's `setup/002-live-access.sql` in a text editor.
3. Copy the entire file into SQL Editor and click Run.
4. Confirm there are no errors. It installs read policies, authenticated action RPCs, immutable evidence rules and private Storage policies.

Existing original tables are preserved. No sample company, worker, rate or work order is inserted. Both work-evidence and invoice-files buckets remain private. The live work-evidence bucket accepts images/PDFs up to 8 MB, scoped to assigned work. Invoice-files is reserved for later issued-file workflows and is not publicly writable.

## 2. Create your first NPI administrator

1. In Supabase → Authentication → Users, create your owner account using an email you control and a private password. Confirm/auto-confirm that account through the dashboard's trusted admin action.
2. Keep the email provider enabled. Disable public self-signup; company accounts are created by administrators through the server function.
3. Open `setup/003-first-admin.sql`.
4. Replace `REPLACE_WITH_YOUR_CONFIRMED_ADMIN_EMAIL` with that exact confirmed owner email. Do not put the password in SQL.
5. Run this file in SQL Editor. It creates the first NPI Admin profile. It will not replace an existing active NPI administrator.
6. The first owner signs in with the actual email address. Company workers later sign in with company usernames.

The browser role picker is gone. A successful Auth password check without an active application profile still cannot access the work database.

## 3. Deploy the account and workbook Edge Function

1. Supabase → Edge Functions → create/deploy a function using the editor. Name it exactly **npi-admin**.
2. Replace the function code with all of `setup/npi-admin.ts`. This is a self-contained file; no imports or npm packages are required.
3. Set the gateway **Verify JWT** option OFF for this function. This is required for server-to-server Sheets requests using publishable API keys. The handler itself verifies browser user access tokens through Supabase Auth before any account operation; workbook calls use a separate private token. Do not remove those checks.
4. Deploy the function. Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY automatically to its server runtime. Do not copy the service-role key into the app or Google Sheet.
5. The default allowed browser origin is https://alaska.npi6030.com. If you intentionally test another origin, set NPI_ORIGIN to that exact trusted origin; do not use a wildcard.

This function lets NPI Admin create subcontractor admin/worker accounts and reset their passwords. A subcontractor admin can create/reset only its own workers. NPI owner account recovery remains in Supabase's trusted dashboard. Company usernames map to internal Auth identities at users.npi6030.com; these are login aliases, not working email inboxes. Password reset is administrator-managed, not an email promise.

## 4. Connect the Google workbook

The previous Code.gs initializer can remain. The original tabs/data are not deleted. Connected tables use new **Live_** tab names so existing user-entered data is preserved.

1. Open your workbook → Extensions → Apps Script.
2. Add a new script file named **LiveSync**, paste `setup/LiveSync.gs`, and save. Avoid duplicate onOpen functions if you customized the project yourself.
3. Run **npiCreateSyncToken** as the workbook owner. This generates a private credential in Script Properties; it does not print the value or put it in worksheet cells.
4. Apps Script → Project Settings → Script Properties: copy the value of **NPI_SHEETS_TOKEN** privately.
5. Supabase → Edge Functions → Secrets: create **NPI_SHEETS_TOKEN** with that same value. Also create **NPI_SHEETS_ID** with `1FJkmwHbZaNLwT4awsSshJpysi95dwBtOOKadig_Ibz8`.
6. Return to Apps Script and run **npiPullLive**, authorizing the owner execution when Google prompts. Reload the spreadsheet to see the **NPI Live** menu.
7. New Live_ tabs contain the actual Supabase records. Rates and totals display USD; hours display hours. Name columns accompany IDs. Original attendance, decisions and identifiers are protected.
8. Edit yellow fields, then choose **NPI Live → Submit edits for NPI review**. New entities are created in the app; the workbook edits existing locations, rate schedules and unstarted work plans.
9. NPI Admin → Spreadsheet review → review/apply or reject each proposal. Expected versions and rate-date overlaps are checked on the server. Refresh the workbook after approval to see accepted data.

Only the workbook owner can run sync by default. The owner can add approved NPI management emails to Script Property **NPI_MANAGER_EMAILS**, separated by commas. Keep this workbook and its bound script limited to trusted NPI management; do not give contractors/workers workbook editing access. There are no employee passwords in Sheets.

Sync is controlled, not instant: Refresh pulls data; Submit queues edits; NPI approves them. Refresh refuses to overwrite unsent edits. An optional owner time-based trigger for npiPullLive can refresh periodically; unsent edits will block a refresh rather than silently disappear. Exports are paged with a 20,000-record safety cap per table. Existing setup tabs are retained; use Live_ tabs for connected data.

## 5. Update the existing Cloudflare Pages project

1. Extract **NPI-Alaska-Live-Integration.zip**.
2. Cloudflare → Workers & Pages → **npi-alaska** → Create deployment.
3. Upload the extracted contents with index.html, _headers, _redirects, live/, three-view/ and icons/ at the upload root.
4. Deploy to the existing project. **Keep your current domain and CNAME unchanged.**
5. Open https://alaska.npi6030.com/live/ first. The root and old /three-view/ address redirect here. If an old installed review PWA still opens a cached sample, open the new /live/ URL online and install this app separately after verification.
6. Sign in with your owner email/password. A Connected to Supabase banner appears only after a successful authenticated database snapshot. There is no demo fallback or sample role switch.

Do not double-click live/index.html for sign-in. Real Auth/GPS/PWA needs the HTTPS-hosted app. The installer includes no browser-only demonstration runtime.

## 6. Enter your actual setup

1. Add the subcontractor company.
2. Add the four locations, their verified addresses and the matching bundled photo selections.
3. Add your actual services/tasks. No contract clauses or private rates are preloaded.
4. People → Create company account: create a Subcontractor Admin, then its workers. Share temporary passwords privately. Passwords use managed Auth; they are not saved in Sheets. Use 12–72 ASCII characters and comply with any stricter project password policy.
5. Rates → add customer charges and separate subcontractor costs by site/service/unit/effective dates. Overlapping schedules for the same scope are rejected.
6. Create a work order, select workers from one company and enter the required checklist.

Roles are enforced in the database/server function. Worker accounts see assigned work; company admins see their company; NPI Admin can verify all work. Customer rates/documents are hidden from contractors and all rates are hidden from workers. Disabling a company/profile through trusted database administration blocks its data access. This build does not expose self-service role promotion.

## 7. Test the first real workflow before inviting staff

1. Worker: sign in, open the assignment, capture a fresh GPS check-in, complete tasks, and upload a work photo. Crew capture may include you and other assigned active workers only.
2. Worker: capture a new GPS checkout and enter any unpaid break. Original device and server receipt times/coordinates are retained; recorded duration uses server receipt time. GPS accuracy is displayed. Web GPS is device-reported, not proof of physical site presence.
3. All assigned workers must check out before each submits claimed hours. Differences from recorded time require explanation. Hauling work also needs whole loads and a timecard upload.
4. Subcontractor Admin: inspect original evidence and approve/forward or request correction.
5. NPI Admin: cross-check recorded versus claimed hours, enter accepted hours and a reason for any change, then approve.
6. Refresh the management workbook. Verify both GPS events, claims, reviewer IDs and accepted hours appear correctly.
7. Test another company's account: it must not read this work, evidence, customer rates or customer documents. Local automated tests do not replace this live check.

Each mutation has a request identifier. If a request times out, its outcome may be uncertain: refresh and inspect before trying a new operation. Same-page retries preserve the identifier. Original events cannot be edited/deleted by browser clients. Sessions stay in memory and require sign-in after reload. Private work data is not cached by the service worker; offline writes are not queued. Unsaved form text can be restored after same-user reauthentication while the page remains open; passwords/files/GPS capture must be entered again as needed.

## Billing scope — important

This release creates **priced subtotal drafts** from NPI-approved work and a matching effective rate. Each draft stores the quantity and rate snapshot and prevents duplicate allocation of that work on the same billing side. Verify worker-hours versus equipment-hours before entering the billable quantity. Drafts can be printed/saved as PDFs, clearly labeled DRAFT / NOT ISSUED.

It does **not** issue tax/legal invoices, send invoices, upload finalized invoice PDFs, record bank payments, reconcile accounts or implement a full accounting ledger. Tax, customer/legal billing details, numbering/terms and any multi-line grouping policy must be finalized before enabling invoice issuance. Tax/total remain unconfirmed rather than silently assumed zero. Do not use a draft as an issued invoice.

## Verification limits and data preservation

Database/RLS/transition tests run in a local PostgreSQL engine. Browser tests use mocked Supabase responses. The workspace's proxy blocked requests to your real Supabase host, and no authenticated deployment connector is available. No SQL, function, script or Cloudflare deployment has been applied to your account by this package. Complete the installation and live acceptance checks before live operations.

Your old browser-only prototype data is not migrated or erased. Keep it until you have reviewed it. Cloud records in this build are authoritative in Supabase. The app currently loads up to 500 recent permitted work orders and bounded related registers; it labels the limit. Use the management export for older records. Larger datasets need additional filtered pagination/reporting before relying on the app for complete historical reporting.
