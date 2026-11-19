# Alaska NPI: review scope and feature map

This version implements the user's three-role operating model as a clickable, device-local PWA sample. It does not create live employee accounts or connect cloud services.

| Area                | Working sample behavior                                                                                                                           | Production dependency                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand               | Navy/silver/gold identity; original-image picker preserves supplied artwork                                                                       | Inline conversation image bytes are not mounted; paste/drop the original directly into the sample, then download a personalized standalone copy |
| NPI Admin           | Assign work across sample companies; final hour verification; customer drafts and contractor quantity decisions                                   | Server authorization and actual company memberships                                                                                             |
| Subcontractor Admin | Own-company workers, assignments, claims, company approval and quantity submissions                                                               | Verified company identity and membership                                                                                                        |
| Worker              | Assigned tasks, equipment, individual/crew attendance, breaks, photos, personal hours and approval progress                                       | Authenticated worker identity, durable private evidence storage                                                                                 |
| GPS evidence        | Separate required check-in and checkout captures; permission/error recovery; accuracy/source/time labels; map links to exact recorded coordinates | Server ingestion, trusted timestamps, agreed accuracy/proximity policy; no continuous tracking                                                  |
| Hours               | Original attendance, per-person claim and NPI acceptance remain separate; adjustment notes; overlap checks                                        | Immutable events and transaction-protected server review commands                                                                               |
| Scheduling          | Date-grouped dispatch; scope filters; edit plans only before attendance; service request to work order                                            | Shared server assignments and notifications                                                                                                     |
| Reports             | Per-worker and per-location totals; claim differences; date-filtered CSV; decision history                                                        | Server-side reporting/paging and retention policy                                                                                               |
| Commercial          | Separate customer/subcontractor basis fields: hourly/fixed/per-visit/per-load; accepted quantities; separate allocation streams                   | Approved rate configuration, tax/accounting policy and financial authorization                                                                  |
| People & settings   | Sample profiles, workspace name/description, logo picker, explicit account/connection readiness                                                   | Supabase managed authentication and server-owned username enrollment; no passwords in Sheets                                                    |
| Management workbook | CSV round trip; review before apply; atomic validation; stale/protected edits rejected; planning-change history                                   | Private Sheets bridge with service credentials, versioned commands and idempotency                                                              |
| PWA                 | Installable shell over HTTPS; offline reopening; device-local saves; cross-tab conflict refusal                                                   | Production offline outbox, server reconciliation, device/user policy                                                                            |

## User decisions preserved

- Exactly **NPI Admin, Subcontractor Admin and Subcontractor Worker**.
- NPI holds the customer agreement and subcontracts delivery.
- Company approves its workers' claims first; NPI cross-verifies original attendance before final acceptance.
- Both attendance events require independent location capture. Crew location is the operator's position, not separate proof for every crew member.
- Support mixed commercial bases and both individual/crew attendance.
- Supabase is the proposed primary records/identity/private evidence system; a management spreadsheet supports controlled two-way updates.
- Private uploaded agreements, signatures, contacts, actual prices and verbatim clauses stay outside the app and downloads.

## Source review

The conversation, maintained PRODUCT.md/UX-CONTRACT.md, current domain gates and privately reviewed agreement context ground the scope. Private agreement text is not reproduced.

Official product pages selected for comparison:

- Connecteam time clock: https://connecteam.com/employee-time-clock-app/
- Jobber product features: https://www.getjobber.com/features/
- Aspire snow and ice operations: https://www.youraspire.com/software/snow-ice-management
- Alaska Court directory: https://courts.alaska.gov/courtdir/3an.htm

These pages and the earlier chatgpt.site reference returned proxy 403 responses during this run. Their current contents, photos, feature lists and building addresses were **not verified**. The implementation therefore uses the user's confirmed workflow, rather than claiming live competitor research or inventing site facts. Actual site photos can be selected separately and are never replaced with fabricated courthouse likenesses.

## Why the workbook is restricted

Only title, planned date and equipment on unstarted assignments can be edited through the local workbook. Company IDs, original times/GPS, claims, accepted hours and approval states are protected. A whole batch fails before mutation if any row is stale or invalid. This demonstrates the control boundary needed for a real management workbook; it does not claim that live Sheets is connected.

## Backend handoff

Use a private management workbook with tabs for Work Orders, Attendance, Worker Claims, Company Reviews, NPI Decisions, Sites, People, Contractor Claims, Customer Drafts, Sync Requests and Audit. Original evidence/review tabs are projections, not editable authority. Editable planning cells submit versioned commands through a server-owned bridge. Supabase transactions enforce company scope, lifecycle gates and append-only events. Never put a Supabase service key, employee password or private document URL in public frontend code or workbook cells.

Before field use, configure managed identities and company scope, transactional work commands, private file storage, immutable event capture, the private workbook bridge, deployment origin, permitted GPS accuracy/proximity behavior, invoice policy and operational acceptance. The current deliverable is for workflow review with fictional records.

## Test transaction and artwork transfer

A single user-started test work order can be created/resumed from the welcome screen or demo bar. It uses the existing required-location and approval gates. The test controls switch preview roles; they do not bypass company/NPI review transitions or create real permissions. No payment transaction occurs.

The original chat images are not automatically embedded. Direct paste/drop/file artwork controls preserve supplied PNG/JPG/WebP bytes, with an 8 MB limit. Large artwork is stored separately in browser IndexedDB and represented by references in the record store. The personalized standalone export embeds only resolved logo/site image data and clears rendered forms/work content. It does not export real login values or local operational records. Proxy-blocked web sources and unavailable image bytes remain documented rather than replaced by invented likenesses.

## Location and task rates

NPI Admin → Settings → Location & task prices. Add/edit separate customer and subcontractor rates with site, task/service, billing basis, USD unit price and effective dates. Overlapping periods within the same scope are rejected. A calculator previews quantities without issuing an invoice. Private CSV export is explicit. Rates are local-only and never seeded into public downloads. A new NPI-Setup-Package.zip includes Supabase SQL foundation and owner-only Google workbook initializer; neither service is created or connected automatically.

## Included site images

Four photographs from the user-supplied ZIP now appear by default: Boney, Nesbit, Snowden and Anchorage Youth Court. The selected logo is displayed using a CSS crop of the desktop reference photograph. No separate high-resolution logo was supplied, so this reference limits sharpness. Images are embedded in the standalone HTML and bundled/cached in the PWA. The port retains its existing placeholder because no port photo was supplied. Source hashes and provenance are in ARTWORK.json.
