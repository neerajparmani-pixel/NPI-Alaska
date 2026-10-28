# NPI Alaska — full-page owner preview, version 2

This version gives you a full-page app with navigation, overview, editable workspace settings and separate readable backend tabs. It runs with Google Sheets and Apps Script before Cloudflare is needed. It is **still an owner-only preview**, not a finished employee login system.

## Install or upgrade

Use a private test spreadsheet you own in **My Drive**. Keep the uploaded reference app and its spreadsheet separate.

1. Open **Extensions → Apps Script** from the NPI Alaska test spreadsheet.
2. Replace **Code.gs** with this folder's latest **Code.gs**.
3. Replace the HTML file named **Index** with this folder's latest **Index.html**. Create it with **+ → HTML** if it does not exist. The filename must be exactly **Index**.
4. Save the project. Select **setupNpiTest** and click **Run**. Review Google's requested authorization using the spreadsheet-owner account.
5. Setup creates/upgrades the backend tabs, saves the spreadsheet binding for the full-page route and preserves previous records in **NPI_Test_Work**. Existing report tabs with incompatible headers or unmanaged data are rejected instead of overwritten. The internal record store is hidden after reports are prepared; it is not deleted.

## Open as a full-page app — recommended

1. In Apps Script, choose **Deploy → New deployment**.
2. Select deployment type **Web app**.
3. Set **Execute as: Me**.
4. Set **Who has access: Only myself**. Company worker authentication is not connected; do not enable public access for this preview.
5. Click **Deploy**, then open the actual **Web app URL** Google provides.
6. Use the same Google account that owns the spreadsheet. The app opens in its own browser tab, without the spreadsheet dialog.

If you already deployed the preview, use **Deploy → Manage deployments → Edit**, select **New version**, then deploy. Saving editor files alone does not update a published deployment. The `/dev` test deployment may show editor changes, but use a controlled private version for the reviewed preview.

Alternative: reload the spreadsheet, then choose **NPI Alaska → Open app window**. The menu name changed from the earlier **NPI Alaska Test**.

No spreadsheet ID or Firebase configuration is needed for this private preview. Setup saves the bound spreadsheet ID securely as project configuration so the web-app route can reopen it when no active spreadsheet exists.

## Backend tabs

| Tab             | Purpose                                                          | Editing policy                                                |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| NPI_Settings    | Workspace name and support contact                               | Edit in Settings or this tab; no secrets/passwords            |
| NPI_Assignments | Site, area, worker, equipment and assignment status              | App-maintained report                                         |
| NPI_WorkLogs    | Work times, completed hours, tasks, loads, notes and corrections | App-maintained report                                         |
| NPI_Attachments | Evidence metadata and private Drive links                        | App-maintained report                                         |
| NPI_Approvals   | Approval/correction decisions and reviewers                      | App-maintained report                                         |
| NPI_AuditLog    | Operation history with actual owner identity                     | App-maintained report                                         |
| NPI_Sites       | Current site/task reference                                      | App-maintained reference; site definitions remain in Code.gs  |
| NPI_Users       | Current authorized owner reference                               | Not employee provisioning or a password store                 |
| NPI_Test_Work   | Internal versioned records, request IDs and recovery source      | Hidden, preserved; inspect via NPI Alaska → Show record store |

The report tabs are readable projections of the versioned record store; they are not separate independently editable databases. Edit work through the app. Direct report edits can be replaced on refresh. This structure preserves record/history/idempotency consistency and allows reports to be rebuilt. Use **NPI Alaska → Refresh backend tabs** if a report fails to refresh. Records remain saved even if report rebuilding fails; the app reports that distinction.

## Test the app

- **My work:** open an assignment, start work, select tasks, save notes and attach evidence. The first empty screen offers **Create a test assignment** so you can set up an initial job.
- **Reviews:** inspect submitted work, approve it or request a correction with a reason.
- **Overview:** view counts across all stored records; the record list is paginated at 20 per page. The Reviews list states when it shows only submissions on the current page.
- **Settings:** edit workspace name/support contact, inspect current access and open the backend tabs. Employee creation/password reset are deliberately disabled and labeled **Authentication not connected**.

Submit at least one task and one JPEG/PNG work photo. Maximum six photos, 2 MB each. Port work also needs whole-number loads and a signed JPEG/PNG/PDF timecard. These are provisional test rules, not final contract policy. Evidence stays in an owner-private Drive folder. Do not share that folder.

## Login scope and the reference app

The uploaded reference demonstrates editable Settings-driven staff/admin setup and role-specific interfaces. Its original ZIP/source remains outside this project and has not been published or modified. We borrow the organization, not its readable-PIN credential storage or any configured values.

The chosen company login type remains **company-issued usernames/passwords**. A Cloudflare project is hosting, not an already-connected identity backend. Real account creation, reset, deactivation, session revocation and user/site/contractor enforcement still require implementation and an approved authentication backend. Firebase is one option; it is not required to inspect this owner preview. Do not put passwords or PINs into NPI_Settings or NPI_Users.

## Troubleshooting

| What you see                     | Action                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Script function not found: doGet | Replace Code.gs with version 2 and publish a new deployment version                                                     |
| Setup needed / cannot find Index | Run setupNpiTest from the bound project and name the HTML file Index                                                    |
| Old interface after changes      | Update both files, save and publish a new deployment version                                                            |
| Owner access denied              | Use the Google account that owns the spreadsheet; Shared Drives are not supported                                       |
| Missing spreadsheet menu         | Save the script and reload the spreadsheet; look for NPI Alaska                                                         |
| Connection needs attention       | Read the inline error; the page offers Try again instead of staying on a blank loader                                   |
| Google response timeout          | A save may have completed. Retry the same action or refresh before creating another record; request IDs protect retries |
| Backend report warning           | The work record is saved. Use Refresh backend tabs to rebuild the views                                                 |

Maximum 500 records, 100 changes per record and 45,000 characters per serialized source cell. Unsaved worker/settings edits stay in memory while changing views; refresh offers discard confirmation and closing uses the browser's standard unsaved-change guard. Reviewed work displays committed values, not unsaved worker edits. Backend versions prevent stale work saves. File signatures, sizes and private-folder access are checked. File creation and Sheets writes are not one atomic transaction; private unused files can require cleanup after an abandoned upload.

## Verification boundary

Automated tests execute the actual frontend and backend with mocked Google services on desktop and phone layouts, including owner denial, full-page binding, multi-tab rebuild/recovery, workspace settings and work approval flows. **The code has not been executed in your Google account.** Your private deployment is the next live authorization/Drive/quota test. GPS, final snowfall/site rules, real employee access, backup/retention and public production deployment remain outside this preview. The new logo is awaited; the temporary NPI wordmark and approved palette are used.

## Interface screenshots

These are local browser-test screenshots with synthetic data, not a live Google deployment:

- [Desktop Settings preview](https://github.com/neerajparmani-pixel/NPI-Alaska/blob/main/docs/previews/spreadsheet-settings-desktop.png)
- [Phone Settings preview](https://github.com/neerajparmani-pixel/NPI-Alaska/blob/main/docs/previews/spreadsheet-settings-phone.png)
