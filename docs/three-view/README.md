# NPI three-view sample

[Download ZIP](https://github.com/neerajparmani-pixel/NPI-Alaska/raw/refs/heads/main/downloads/NPI-Three-View-Sample.zip), extract it, then open **START-HERE.html**. No login, terminal or spreadsheet setup is needed to try the workflow.

Exactly three view choices appear on the welcome screen and in the workspace role dropdown:

- **NPI Admin:** assign work, see all sample companies, verify hours, inspect original evidence and review billing quantities.
- **Subcontractor Admin:** see only Northern Field Services, manage sample worker profiles, assign its own workers before attendance begins, review workers’ claims, forward them to NPI and submit quantity claims.
- **Subcontractor Worker:** see Alex’s assignments, check in/out with independently captured locations, complete tasks/evidence, submit personal/crew hours and view personal history.

## A complete review

1. Choose Subcontractor Worker → open Boney Courthouse → check in. Use device GPS in a supported secure context, or choose the clearly labeled example GPS for this sample. Crew mode records an explicit roster.
2. Complete the checklist, add example evidence or a local completion photo, then check out with a **new** captured position. Enter breaks.
3. Submit claimed hours per roster member. If hours differ from attendance, give a reason.
4. Switch to Subcontractor Admin → Review hours → inspect evidence → Approve & forward to NPI.
5. Switch to NPI Admin → Verify hours → compare original positions/times and claims → accept hours. Per-worker adjustments require a reason and preserve original records.
6. Subcontractor Admin can prepare an unpriced quantity claim for NPI-approved work. NPI can accept quantities or request a revision. Customer invoice checklists use a separate allocation stream. No rates, amounts or payments are included.

The preloaded crew claim also demonstrates a discrepancy immediately. The hauling assignment additionally requires a whole-number load count and timecard evidence (example timecard in this prototype). No private operational threshold, actual deadline or contract term is preconfigured.

## Privacy boundary

The uploaded documents were private reference material, not app inputs. No PDFs, OCR, signatures, actual prices, private contacts or verbatim contract text are included in the code, downloads or repository. New companies, names and data are fictional. Financial amounts are entirely omitted. Unresolved agreement mappings remain unassigned.

Original site photos and the selected emblem are not available as downloadable image files here. Locations have separate photo slots and local pickers. No generated picture is represented as a real property photograph. Addresses are not imported; NPI Admin can type a verified address into the sample. Event map links use the recorded coordinates; an unconfigured reverse lookup is reported rather than fabricated.

## Visual reference

The latest refinement keeps the navy identity and workflow while using a consistent Source Sans 3 type scale, compact branding, desktop sidebar and labeled mobile page selector. The original emblem file is not embedded; select the unchanged original in NPI Admin → Settings. Photo pickers likewise accept actual site images locally.

## PWA and backend

[HTTPS PWA bundle](https://github.com/neerajparmani-pixel/NPI-Alaska/raw/refs/heads/main/downloads/NPI-Three-View-PWA.zip). Deploy the extracted contents to a static HTTPS host for install/offline sample testing. No live deployment is performed. `/three-view/` is the app route; previous demos remain separate. The standalone HTML is the easiest clickable review file. The managed test browser blocks file URLs, so the exact self-contained HTML was tested over HTTP; end-user local storage and device-GPS permissions vary.

All changes stay on the current device. Scope filters and role buttons are previews, not authentication. Supabase, managed company logins, private file service and two-way management Sheets integration remain unconnected. The local dataset is capped at 20 work records; production needs bounded API queries and server authorization. Reset in Settings affects only this sample.

[Plan](PLAN.md) · [Audit and screenshots](AUDIT.md). Rebuild with `npm run package:three-view`.

## New management flows

- **Schedule & dispatch:** edit title/date/equipment before attendance starts; turn a service request into a work order.
- **Reports & audit:** compare per-worker/location totals, inspect discrepancies and export a date-filtered report.
- **Management workbook (NPI):** export CSV, edit allowed planning cells, import or paste it, preview and apply. Stale or protected edits reject the entire batch. “Load an example change” makes this easy to try.
- **Workspace settings:** edit the display name/description, select the original logo, and see account/integration readiness.
- **Worker phones:** use the four labeled bottom buttons for work, hours, sites and help.

[Full feature map, source review and backend handoff](FEATURES.md). The selected lion artwork is confirmed; only its original image bytes are pending reattachment. Real logins, Supabase/Sheets sync and invoice delivery are not connected.

## Try one transaction

1. Open START-HERE.html and choose **Start test transaction**. It creates one clearly labeled test work order and opens the worker's assignment. Reopening the button resumes that same record.
2. **Check in → Capture example GPS** (or request real device location) → confirm. Complete all three tasks and add completion evidence.
3. **Check out → capture a new position** → confirm → submit claimed hours.
4. Use the test bar: **2. Company review** → Approve & forward → **3. NPI approval** → compare original evidence → accept hours.

The test has no rate, payment or sent invoice. Existing work/evidence is preserved. Example checkout creates a two-hour interval for a quick test; breaks reduce the claimed/accepted worker-hours.

## Add the exact pictures without another chat upload

The conversation's inline images are still unavailable as downloadable workspace files, and external photo sources returned network-proxy blocks. The app therefore provides a direct image transfer:

- On the welcome screen choose **Paste your logo**. Copy the actual logo image from the chat, click the paste box, and press Ctrl+V / Command+V. Drop/file selection is also available.
- Choose NPI Admin → Sites & snowfall → **Paste site photo** on the matching building card. Each location stores its own image.
- For a reusable self-contained copy, open NPI Admin → Settings → **Download with my pictures** from START-HERE.html. It embeds only the selected logo/site pictures, excluding live work records and credentials.

PNG/JPG/WebP artwork up to 8 MB is supported without resizing/recolouring. Larger files use this sample's browser image database to avoid filling its JSON record store. Both the images and operational sample records remain on your device. The personalized-download action requires the standalone HTML; the hosted/PWA view shows guidance to use that file.
