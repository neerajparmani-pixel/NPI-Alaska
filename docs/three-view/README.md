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

The user-provided screenshots define the split login and navy sidebar workspace. The original emblem file is not embedded; select the unchanged original in NPI Admin → Settings. Photo pickers likewise accept actual site images locally.

## PWA and backend

[HTTPS PWA bundle](https://github.com/neerajparmani-pixel/NPI-Alaska/raw/refs/heads/main/downloads/NPI-Three-View-PWA.zip). Deploy the extracted contents to a static HTTPS host for install/offline sample testing. No live deployment is performed. `/three-view/` is the app route; previous demos remain separate. The standalone HTML is the easiest clickable review file. The managed test browser blocks file URLs, so the exact self-contained HTML was tested over HTTP; end-user local storage and device-GPS permissions vary.

All changes stay on the current device. Scope filters and role buttons are previews, not authentication. Supabase, managed company logins, private file service and two-way management Sheets integration remain unconnected. The local dataset is capped at 20 work records; production needs bounded API queries and server authorization. Reset in Settings affects only this sample.

[Plan](PLAN.md) · [Audit and screenshots](AUDIT.md). Rebuild with `npm run package:three-view`.
