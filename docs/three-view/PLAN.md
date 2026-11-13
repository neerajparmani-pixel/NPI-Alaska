# Three-view sample: approved scope

The current user request authorizes building a sample after private review of the uploaded documents. Exactly three role previews: NPI Admin, Subcontractor Admin and Subcontractor Worker. Worker hours go to their company's admin first; NPI then verifies original check-in/out evidence before accepting hours. Both attendance events independently require a captured location. Individual and crew entries are supported. This file records generic product decisions only: it contains no uploaded document text, actual prices or private contacts. Uploaded PDFs/OCR remain outside the repository and packages.

## Visual target and limitation

The user prefers https://alaska-npi-operations-demo.nxk230076.chatgpt.site/ and subsequently supplied two screenshots. Those screenshots now define the visual source: split navy/light welcome screen, fixed navy sidebar, white top bar, navy/gold banner, four metrics and activity/attention columns. Retain exactly three role previews. The live page is still proxy-blocked, but screenshots remove the layout ambiguity. Original emblem bytes are unavailable; Settings accepts the original image unchanged. Do not use the different logo found in the reference archive.

## Screen responsibilities

- NPI Admin: cross-company work overview, assignments, recorded/claimed/accepted hours, final verification, billing-quantity records, sites and setup status.
- Subcontractor Admin: own company assignments/team, review workers' claims, forward to NPI, own bill-quantity submissions and account setup preview. Never another company's work or customer-side billing.
- Subcontractor Worker: assigned cards, tasks, work evidence, independent location check-in/out, own-hour history and correction/resubmission.

## Sample boundaries

No contracts, actual prices, documents, personal contacts, signatures or verbatim clauses are imported. The sample omits financial amounts altogether; billing demonstrates approved quantities, references, review statuses and separation of customer vs subcontractor documents. Unknown historic/general agreement mappings remain unassigned. All people/companies/events/timesheets are synthetic. No real accounts, authorization, service connections, sync, invoice sending or transfers. A real backend is still planned for Supabase plus controlled two-way management Sheets access.

## Interaction owners

Pure recorded-hour, location-completeness, review gates and overlap logic reuse public/operations/domain.js. The new isolated distribution adapter owns shared btn/field/dialog/table/status/save/navigation primitives and one token stylesheet. Native selects/dates retain platform geometry. App-owned inline validation, dirty-form guards, local rollback, cross-tab conflicts and scope-safe previews are required. Both coordinates open separate map links; reverse-geocoded addresses are never invented. Actual site pictures remain local picker inputs until original files or verified reusable sources are available.
