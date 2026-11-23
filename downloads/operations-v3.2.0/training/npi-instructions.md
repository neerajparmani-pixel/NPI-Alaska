# NPI Admin — task instructions

Actual frontend recording using intercepted fictional responses; GPS and cloud responses simulated. No production data.

## 00:00:00 — Company account
After approval, sign in with your own username or email and password. This recording uses fictional records, simulated email, location and a test camera. No live work is created.

## 00:00:13 — Invite NPI or subcontractor administrators
People and access supports multiple NPI administrators and multiple administrators per subcontractor. Choose the role and invited email. Select a company for a subcontractor administrator. Each person creates their own credentials.

## 00:00:29 — Approve verified registrations
Pending approvals shows registrations separately from active people. Inspect the email and role, then approve or reject. A new NPI administrator must be approved by the inviting NPI administrator. Access changes are recorded in history.

## 00:00:46 — One-time contract setup
Set up the main contract, authorised sites and subcontractor access once. Invite the subcontractor administrator. Their approved workers can then start work without waiting for an assignment.

## 00:00:58 — Line items and sub-line items
Settings holds each contract’s line items and sub-line items. Codes stay in management records; workers see simple service names. New snow services stay in draft until bands cover zero upwards without gaps. The Below 2 inches band is created for you. Activate the parent after completing the remaining bands. No prices are included.

## 00:01:22 — Periodic review queue
Use the overview and NPI verification queue to review submitted work. The company reviews first. Current activity, open issues and exceptions are visible without creating daily assignments.

## 00:01:36 — Verify the complete visit
Inspect the same crew, services, quantities and snow evidence that the company reviewed. Recorded, claimed and accepted hours remain separate. Multiple service lines do not multiply worker attendance.

## 00:01:50 — Accept or request correction
Acknowledge the below-two-inch flag. Accept the exact claimed hours or enter a correction with a reason. Return incomplete records to the company. Original photos, attendance and the review history are retained.

## 00:02:04 — Download complete reports
Generate a report for the selected period, company, site, worker, service and status. CSV and Excel contain every matching row, beyond the on-screen page. Recorded, claimed and approved hours remain separate and are counted once per worker.

## 00:02:22 — Printable summary and private evidence
Download a PDF summary for sharing. Full detail stays in CSV and Excel. Evidence reports reference authenticated work records. Select up to twenty originals for a private evidence ZIP. Exported report links never expose permanent public photos.

## 00:02:40 — Seven-tab management workbook
The management workbook keeps seven tabs. Supabase remains the primary database. Permitted site and unstarted planning edits return for NPI review; hours and approvals stay protected. Settings shows the latest successful sync. Hide recognised legacy tabs only after a successful refresh; no data is deleted.

## 00:03:01 — Notifications and deployment
Configure notification recipients and optional daily summaries in Settings. A verified email sender is required for new registrations and password recovery. Existing users remain active. Apply migration eight, update the function and workbook script, then deploy the frontend. Test real email and GPS before using the upgrade for live shifts.
