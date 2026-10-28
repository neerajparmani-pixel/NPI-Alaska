# Spreadsheet-first test — no Cloudflare or Firebase required

Use a **new private spreadsheet that you own in My Drive**, not a real operational workbook or a Shared Drive file. This is an owner-only workflow test, not a deployed worker app. All preview views run under your owner identity; the selector is not login or authorization.

## Paste the two files

1. Create a blank Google Spreadsheet and name it **NPI Alaska — Test**.
2. Choose **Extensions → Apps Script**.
3. Replace the starter contents of **Code.gs** with this folder's **Code.gs**.
4. In Apps Script, click **+ → HTML**, name it **Index**, and replace its contents with this folder's **Index.html**. The name must be exactly **Index**.
5. Save the project. In the function dropdown, select **setupNpiTest**, then click **Run**.
6. Review Google's permission request and authorize with the Google account that owns this test spreadsheet. The code needs access to this spreadsheet and private Drive evidence storage. If your company blocks custom scripts, ask its Google Workspace administrator; do not bypass company policy.
7. Return to the spreadsheet and reload the browser tab.
8. Choose **NPI Alaska Test → 2. Open app**. You do not need to click Deploy or make the app public.

No spreadsheet ID or deployment URL needs to be entered for this bound-script test. The code uses the spreadsheet it is attached to.

## Test the workflow

1. Select **Supervisor** preview → **Create assignment**. Choose a site, work area, sample worker name and equipment.
2. Select **Worker** preview → open the assignment → **Start work**.
3. Select completed tasks and enter optional notes. **Save draft** writes those fields to the spreadsheet.
4. Add a JPEG/PNG work photo, up to **2 MB** each; maximum six photos. For **Tote Port**, enter whole-number loads and attach a signed JPEG/PNG/PDF timecard, up to **2 MB**.
5. Click **Submit work for review**. Submission requires at least one task and work photo; port work also needs loads and a timecard.
6. Select **Supervisor** preview, open the submission, and **Approve work** or enter instructions and **Request correction**.
7. Select **Worker** preview to correct and resubmit a returned record.
8. Select **Management** preview to inspect the saved statuses and record history.
9. Close the app and inspect the **NPI_Test_Work** tab. Reopening the app reads those same records from the spreadsheet.

Evidence is stored in an owner-private folder named **NPI Alaska — private test evidence** in Google Drive. Do not share the folder. Use the file links in the app to view evidence. Photos also load as inline previews through the authorized script. GPS, snowfall categories and final site-specific forms are not part of this first spreadsheet test.

## Safety and limits

- Every callable backend action verifies that the active and effective Google identity both match the spreadsheet owner. Other editors and anonymous users are denied; this is intentional.
- Only the separate **NPI_Test_Work** tab is created. Existing tabs and app files are not reset. Re-running setup preserves records and rejects mismatched existing headers.
- Scripts store real test data in Sheets/Drive; sample names are entered by you, not real worker accounts. No passwords are stored in Sheets and no fake worker login is provided.
- Record versions detect concurrent edits. Request IDs make retries idempotent. History is stored alongside each record. Notes/assignment text are protected against spreadsheet-formula injection. Uploaded content signatures, sizes, types and private-folder access are checked server-side.
- File creation and sheet writes are not one database transaction. Upload names include the operation ID so retries reuse a previous private file after a failed sheet write; unused files can still require owner cleanup after an abandoned operation.
- Unsaved local drafts stay in memory while switching preview views. Reviewer/management screens show the saved spreadsheet values. Use Save draft before closing. Refresh offers an app-owned discard confirmation when drafts are unsaved.
- Maximum 500 records, 20 per page, 100 changes per record and 45,000 characters per serialized sheet cell. Use a new private test spreadsheet if limits are reached. No deletion, bulk reset or cleanup API is provided.
- Unit/browser tests exercise this code against mocked Google services. It has **not been run in your Google account**. Permission, Drive quota and company policy behavior need your live test.

## Next stage

After you review this workflow, connect the external PWA to a secured API, implement actual company-issued user provisioning/login and role/site/contractor authorization, and finalize privacy, evidence and backup policies. This owner-only test must not be made public or presented as production worker authentication. The approved logo file remains pending; this version uses an NPI text heading with the navy/silver/gold theme.
