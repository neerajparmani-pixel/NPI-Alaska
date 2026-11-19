# NPI AK Tracker OS — Phase 1

Source: user's approved conversation scope, reviewed 2026-10-27.

## Goal

Track assigned work at Courthouse, David Dowd and Tote Port, collect work evidence and provide supervisor approval and management visibility. No financial processing in Phase 1.

## Approved workflow

Administrator setup → supervisor assignment → worker starts → tasks and evidence → submission → supervisor approves or requests correction → worker resubmits → management tracks status.
Workers see their assignments and history. Supervisors assign/review. Management monitors operations. These are demo views until server authentication and user/site scopes are configured.

## Current implementation

A browser-local functional demo with synthetic records, IndexedDB drafts and attachments, PWA shell and role previews. It is not a live multi-user service. Sample site names are from the discussion; worker names and assignments are synthetic. No actual four Courthouse areas or exact contractual evidence requirements were provided.
A demo submission requires at least one task and one photo; port submissions additionally require nonnegative integer loads and a signed timecard. This is a provisional demo rule, not a confirmed NPI policy. Sample existing records deliberately include missing evidence to support review discussions.

## Unresolved before field release

- Company-issued usernames/passwords confirmed. Managed Firebase password verification code exists; company identity project/runtime configuration and user enrollment remain pending.
- Actual user roster, contractor membership, supervisor site scope and approval authority.
- Approved sites/areas, equipment, per-site tasks, weather/snowfall definitions and exact evidence requirements.
- Company spreadsheet/Drive ownership, storage/retention policies and deployment access.
- GPS consent/requiredness, correction policies, manual time adjustments and timezone policy for exports.
- Pilot users and acceptance criteria.

## Technology decision

Cloudflare Pages PWA, Google Apps Script backend, one management-only spreadsheet with multiple tabs and restricted Drive attachments. No public spreadsheet sharing. Authentication and server authorization are mandatory before handling real data. No company credentials in source/browser storage.

## Branding and delivery

User selected silver lion/navy wings/gold stars. Color theme applied, exact logo image file pending. Deployable demonstration and source archives are provided; no live Google Sheets/Drive or production authorization claim. See DEPLOYMENT.md and backend/AUTH.md.

## Spreadsheet-first review stage — 2026-10-28

User requested frontend and Apps Script code to inspect inside Google Sheets before Cloudflare. `spreadsheet-first/` is an isolated owner-only test with actual sheet/file write operations: assignment → start → tasks/evidence → submit → correction/resubmission → approval. Preview views do not represent authenticated workers. Owner identity is checked at each server call; employee passwords are not stored in Sheets. Cloudflare/Firebase app remains separate and unchanged. GPS/snowfall, real user accounts, final per-site policy and production deployment are deferred, explicitly documented.

## Owner preview revision and reference input

User requested a full-page app, professional multi-tab backend and login/admin configuration similar to their privately uploaded NPI app. Version 2 adds a private Apps Script web entry, revised interface, editable general settings and eight readable backend tabs while preserving all prior test records. The supplied reference was inspected only; credentials and unrelated modules are not copied. Real employee account administration remains blocked by missing authentication implementation/configuration; a Cloudflare hosting project does not establish a Firebase or other identity project. New Alaska logo remains pending from the user.

## Supabase + Sheets clickable sample — 2026-11-13

User requested a clickable sample first, preserving the uploaded reference only as guidance, and now specified Supabase plus Sheets as the future backend. `public/sample/` is a separate demonstration, not a migration of existing owner records or a connected backend. User confirmed two-way synchronization because some managers work only in Sheets. Proposed architecture: Supabase Auth/database/private Storage as authority, with a private management workbook that supports validated, versioned changes through a server-owned bridge. The sample simulates title edits, exports, protected fields and conflict resolution; no real connection exists. Company username enrollment needs a server-owned mapping to managed identities; no passwords in Sheets or local demo storage. User confirmed Boney Courthouse, Anchorage Youth Court, Snowden Courthouse and Nesbit Courthouse from Chris’s inline photos. Original downloadable photo files, exact addresses/areas and evidence policies remain pending; sample imagery is illustrative. All new people/jobs/roles are synthetic. Settings edits operate locally and provision no accounts. Phase 1 finance remains deferred.

## Subcontract operations revision — 2026-11-13

User expanded the scope: NPI holds a customer contract and subcontracts work to another company. Mixed hourly/fixed/per-visit/per-load customer and subcontractor pricing, individual and explicit crew attendance, and financial monitoring now belong in the revised sample. The subcontractor approves its workers' claimed hours first; NPI then verifies against original check-in/out evidence and accepts/returns hours. BOTH events require independently captured locations. `public/operations/` implements this as an isolated local prototype. The earlier `/sample/` remains separate. Source policy and unresolved production rules: docs/operations/PLAN.md. No real rates, customer documents, payments or server permissions are asserted.

## Three-view revision and private-reference boundary

Current user authorization: build a sample with exactly NPI Admin, Subcontractor Admin and Subcontractor Worker, using the preferred linked demo as the intended visual reference. Contract files were reviewed privately only. Do not embed, upload, publish or package those files, actual prices, private contacts or verbatim clauses. The new isolated /three-view/ sample omits all financial amounts and uses fictional companies, people and records. Historic/general agreement mappings remain unassigned. The user supplied two screenshots of the preferred demo; the sample now follows their split login and sidebar workspace layout. The live URL remains blocked in this workspace. The original emblem can be inserted unchanged in Settings. Private source documents/OCR are outside the repository. See docs/three-view/PLAN.md for generic scope only.

## Complete professional review revision — 2026-11-18

User requested all conversation context be incorporated into the professional version. Extend /three-view/ in place with schedule/dispatch, request-to-work-order conversion, scoped reports and CSV, guarded management-workbook round trips, editable workspace settings and labeled phone worker navigation. Retain exactly three roles and the company-first/NPI-final approval model. Customer and subcontractor billing bases are separate illustrative metadata; rates, financial amounts and private agreements stay excluded. The selected logo design is confirmed in chat; its original image bytes are not mounted, and the different logo in the reference ZIP must not be substituted. Feature/source/deployment boundaries: docs/three-view/FEATURES.md. Authentication and real Supabase/Sheets/alerts/payment connections remain unconfigured; do not describe this bounded local review sample as a deployed production system.

## Guided transaction and original-image transfer — 2026-11-18

User requested the original logo/site pictures and one transaction for portal testing. Original inline-image bytes remain inaccessible; courthouse/Wikimedia/reference fetches return network-proxy 403. The sample adds a direct paste/drop/file path for the user's actual images, preserving the artwork without generating substitutes. Large artwork uses device-local IndexedDB. A standalone personalized export includes artwork only and excludes login input and local work records. Start test transaction creates/resumes one clearly labeled synthetic assignment using existing required-location, evidence and company/NPI gates. This is a work transaction, not a payment or real customer invoice.

## Rates and backend setup foundation

The user now authorizes blank price entry settings by location/task and separate customer/subcontractor rate lists. No private rates are copied from contracts. Rates are saved locally as USD integer cents with effective-date overlap validation and explicit version increments. Calculator is a subtotal preview only; existing invoice quantity checklists stay unpriced. No tax/contract quantity assumptions, issued invoices or payment states are added. Supabase and Google accounts do not exist yet; setup/ contains a default-deny database foundation and owner-only blank workbook initializer, not a live backend or a sync implementation.

## Embedded image delivery

User supplied NPI Alaska app pictures.zip with four named site photographs and two layout references. Embed the four photos as unchanged original JPEG bytes and display the selected emblem region from the desktop layout photograph. No separate original logo file or port image was supplied. These image defaults now ship with the standalone HTML and PWA and work offline. Custom user selections continue to override defaults; no existing records or selected artwork are overwritten. Database/account/sync status remains unchanged.

Requested custom domain: alaska.npi6030.com. Deployment packaging includes domain instructions, but no live hosting, DNS or account connections are configured. Transparent logo derivative is approved in scope by the background-removal request; original supplied site photos remain unchanged.

## Live integration candidate

The user supplied the publishable key and confirmed both the foundation SQL and workbook initializer ran successfully. Target Supabase project fyfjsqhnxcktjdihcaks and the management workbook are configured in public/live/config.js. No privileged deployment/account connector is available, and direct project requests fail at the network proxy. New live code is prepared, not remotely installed.

/live is separate from the earlier browser-only review runtime and never imports its state or offers a role picker. Managed Auth identities map to server-owned npi_profiles. RLS/RPC functions enforce tenant scope, append-only GPS, crew membership, tasks/evidence, worker claims, subcontractor approval and NPI acceptance. Explicit recorded/claimed acceptance preserves raw minutes rather than applying display rounding. Fresh GPS is mandatory for each event. Privileged account provisioning/reset runs only in a Supabase Edge Function after Auth verification.

The workbook bridge uses a server-only token and a fixed workbook ID; editable location/rate/unstarted-plan fields are queued for NPI review with expected versions. Original attendance and decisions remain protected. Supplier references are unique per supplier and customer references per NPI. Billing creates priced subtotal drafts, snapshots and print-to-PDF only. Tax/legal issuance, payments, reconciliation and full accounting are not implemented; do not infer zero tax. No real data, contracts, prices, employee credentials or privileged keys are seeded/published.

## Restore approved UI on connected backend

User reported the connected interface differed from the approved sample and requested correction. Restore its oversight composition while keeping real Supabase APIs and exactly three roles. This is a frontend upgrade: no migration rerun, account recreation or workbook reinitialization. Do not add dummy records or claim unsupported service-request, issued-invoice/payment or contract workflows are implemented. The original backend installation and existing records stay in place; the changed package is deployed to the same Cloudflare project/domain.

## Current release: Operations 1.0 (supersedes earlier billing scope)

NPI receives customer contracts, then assigns contract/site responsibilities to subcontractors. NPI invites the company administrator using a single-use, seven-day link. That administrator chooses its own managed credentials, invites workers using its own company link, approves registrations and assigns daily work to approved workers at its permitted sites. NPI does not need the worker roster before inviting the company. Future contracts and companies use separate scoped responsibilities. Exactly three roles remain.

A worker signs up through the company link and remains inactive/pending until that company's administrator approves. Pending/rejected/paused accounts cannot access operational records. NPI oversees all work and can pause access, but normal worker registration approval belongs to the company. Subcontractors review hours/evidence before NPI can accept them. NPI sees original check-in/out GPS, device/server times, task/photo evidence, claimed and accepted hours. No original evidence is replaced by an adjustment.

Billing, rates, invoices and payments are deferred. Earlier finance tables/records are preserved for migration compatibility, but the operations snapshot returns empty finance collections and finance mutations are blocked. UI finance routes and form handlers are removed. Workbook defaults now cover contracts, responsibilities, people, work, attendance, hour reviews, changes and audit, with existing planning/location proposal safeguards. Private contracts, prices and actual source files remain excluded from the release archive.

Authoritative implementation: setup/supabase/004-operations-invitations.sql and supabase/functions/npi-admin/handler.js. Complete release archive and four-step existing-install upgrade: setup/OPERATIONS-START-HERE.md. It is an installer, not a remote deployment or a claim of final cloud acceptance.
