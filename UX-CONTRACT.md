# UX Contract

## Product context

Alaska field workers on phones; supervisors and management on phone/desktop. Initial locale en-US. Work dates display in America/Anchorage; timestamps store ISO UTC. Product scope and pending policy decisions: PRODUCT.md. Visual identity: DESIGN.md; canonical runtime tokens in src/styles.css. WCAG 2.2 AA is the target; no formal compliance claim.

## Canonical UI Map

| Capability     | Canonical owner                                              | Source of truth | Allowed variants                                                  | Verification                   |
| -------------- | ------------------------------------------------------------ | --------------- | ----------------------------------------------------------------- | ------------------------------ |
| Select/Listbox | Native select elements in app.js                             | UX-CONTRACT.md  | OS-owned popup geometry and keyboard behavior accepted            | browser workflow tests         |
| Form           | assignment() and shared field styles; domain.submissionError | PRODUCT.md      | assignment creation, work editing                                 | workflow.spec.js               |
| Scrollbar      | src/styles.css global rules                                  | DESIGN.md       | standard and WebKit fallbacks, forced colors                      | strict static audit            |
| Toast          | app.js toast()                                               | UX-CONTRACT.md  | success, save failure, location guidance                          | role=status and workflow tests |
| CRUD           | domain.transition; storage readState/writeState              | PRODUCT.md      | create returns to records; draft stays; submit returns to history | domain and browser tests       |

## Behavior

No hard delete, account administration, real login, or financial operations in the demo. Demo identity selector explicitly previews views and is never a security boundary. No real data should be entered.
Start captures timestamp. Draft edits persist locally. Submission records finish time once, validates required evidence, and returns to history after local persistence succeeds. Correction preserves previous finish time. Supervisor corrections require text; approved/submitted worker records are read-only. Photos validate type, size and count; local save failures preserve the previously saved record. Files are private to this browser and are never labeled uploaded.
All mutations show success only after local storage completes; failures retain editable state. No automatic geolocation: a dedicated action requests browser permission. GPS failure does not block the demo.
Assignment forms use novalidate and inline errors with focus on the invalid field. Native task/checkbox/select controls own keyboard behavior. Textareas use resize:none with sufficient initial height. No app modal required.

## Navigation and datasets

Demo datasets are small; render cards and filter by site. Filters are transient, intentionally not URL-persisted in this prototype. Live service must add bounded server pagination. Back returns to the originating list, retaining filter. Screen changes preserve saved drafts. Browser reload resets the demo view to Worker; records remain in IndexedDB. No real account tokens stored. Storage-unavailable errors show reload guidance.

## State and accessibility

Empty lists show next-step guidance. Role/status labels never rely on color. Buttons have hover/focus/disabled states. Shared notifications announce via role=status; inline errors use role=alert. Ordinary buttons are at least 54px tall. Reduced motion and high contrast supported. Natural document scroll, no hidden scrollbars. Offline banner explicitly says changes stay on device; no background submission or synchronization claim.

## Verification

Unit tests cover transitions, correction reasons, protected states and port evidence. Browser tests cover assignment → work → failed validation → photo → submission → correction → resubmission → approval → reload, filters, empty views, management view, keyboard focus and phone overflow. Deployment, real authentication, live API quotas, multi-device sync and production Drive permissions remain unverified and blocked pending configuration.

## Company login and brand

User confirmed company-issued usernames/passwords. Login uses native labels/autocomplete, masked password, show/hide and generic inline errors. Failure preserves username, clears password and retains form context. Authentication is server verified with an encrypted HttpOnly cookie; it does not grant work access until UsersRoles and the work API are connected. No client role picker on login. `brandMark()` owns header/full identity display. Original emblem file pending; temporary wordmark is explicitly documented.

## Spreadsheet owner-test surface

`spreadsheet-first/Index.html` is a self-contained Apps Script HtmlService surface, intentionally separate from the Cloudflare PWA. Shared native controls, blue/white actions, app-owned validation and status messages follow the existing visual tokens. Canonical backend contract is in spreadsheet-first/README.md and Code.gs. The backend checks actual owner identity on every RPC, enforces versions/state and uses private Drive evidence. Native selects retain platform-owned popup behavior. Modal draft discard uses native HTML dialog with app-owned text and cancel-first focus; page unload uses the browser's standard unsaved-change mechanism. Reviewer views read only committed fields; worker drafts preserve their original version so a refresh cannot silently merge stale edits. Dataset navigation is server-page-limited to 20 rows; filter/reviewer scope is the current page and says so. Browser verification uses mocked Google RPC/Sheets/Drive, not an actual deployment.

## Full-page entry and multi-tab backend

Version 2 adds doGet and a saved spreadsheet binding for a private owner-only Google Web app. The server still verifies active/effective owner identity at every RPC. Setup preserves existing source records and creates eight readable tabs; reports are rebuilt from the atomic versioned record store. Failed report refresh returns a warning without pretending the primary save failed. NPI_Settings holds editable non-secret workspace details; Users/Sites are reference tabs, not employee access grants. Settings exposes actual account/setup status; unconnected account creation/reset remain disabled with reasons. RPC waiting is bounded at 45 seconds; uncertain save results retain the same retry key. Initial loading failures show recovery. Management counts cover all stored records, not just the visible page. The reference archive remains private and unmodified.

## Clickable Supabase + Sheets proposal

Separate deliverable at `public/sample/`, preserving original app and spreadsheet preview. Shared tokens are the inline `:root` adapter in its single-file index.html; all sample views use the same renderer, field, button, status, dialog, local commit and navigation owners. Native selects and dates accept OS popup geometry; all displayed work dates use Alaska time. Sample role switch is explicitly a preview. Sample people editing never stores passwords or grants access. Work mutations use one local commit function; storage errors roll back and retain input. Offline changes stay on this device and are never described as synced. No financial actions. No destructive reset without named confirmation. Drafts are protected on app navigation, dialog dismissal and unload. Cross-tab edits become a conflict warning and require reload; no silent last-writer overwrite.

| Capability     | Canonical owner                       | Source of truth | Allowed variants                        | Verification                 |
| -------------- | ------------------------------------- | --------------- | --------------------------------------- | ---------------------------- |
| Select/Listbox | sample field() native selects         | UX-CONTRACT.md  | OS popup                                | prototype.spec.js            |
| Date           | sample native date input              | UX-CONTRACT.md  | date-only local calendar                | prototype.spec.js            |
| Form           | sample field()/validate()/form dialog | PRODUCT.md      | work, person, site                      | prototype.spec.js            |
| Scrollbar      | sample :root and global CSS           | DESIGN.md       | native geometry                         | computed style browser check |
| Toast          | sample notify() live region           | UX-CONTRACT.md  | local success, error                    | prototype.spec.js            |
| CRUD           | sample commit()/render()/go()         | PRODUCT.md      | create/edit work and people, deactivate | prototype.spec.js            |

## Subcontract operations adapter

`public/operations/operations.js` owns this self-contained sample's shared field(), btn(), table(), dialog(), save() and render() primitives. Native selects/date controls accept platform popup behavior. Global CSS is adapted from the established tokens. Domain calculations/review gates are in public/operations/domain.js; user-confirmed workflow is docs/operations/PLAN.md. Source records, worker claims and NPI decisions stay separate. Per-worker claims and accepted totals have explicit roster allocations. Contractor-scoped views omit customer rates/margins and other contractors. These are preview capabilities, not real authorization. In production they require server/RLS enforcement.

Location capture is explicit at each event, with disabled confirmation until capture, denied/timeout/unavailable recovery, independent coordinates and accuracy, source labels, and coordinate map links. No fabricated reverse-geocoded address; candidate site address differs from event address. Crew capture identifies the operator and is not individual proof. Original evidence is preserved; overlapping ended attendance blocks NPI approval. Billing gates require NPI approval and both locations, independently snapshot customer/contractor rates, reserve work allocations against duplicates, prevent approval of mismatched bills, and bound recorded receipts/payments to outstanding balances. These are sample bookkeeping records, not money transfers or sent invoices. Dialog dirty guards, page-unload protection, local-save rollback and stale-tab refusal apply. Production offline queues and verified identities remain unimplemented.

## Three-view sample adapter

User-confirmed source: docs/three-view/PLAN.md (generic requirements only; private documents are not copied). public/three-view/app.js owns shared btn(), field(), modal(), table(), save(), render() and go() for this separate download adapter. Pure event/hour/review gates reuse public/operations/domain.js. Native Select/Listbox and Date controls accept OS geometry/keyboard behavior. style.css owns the palette adapter, scrollbars, focus and responsive layout. These are the canonical owners for all screens in the new adapter, rather than new per-screen control systems.

Only three preview roles exist; permissions must be implemented on the server before real use. Company and worker filtering scope all displays; NPI combines final review and management responsibilities. Worker→company→NPI review order is enforced in sample transitions, with original events/claims preserved. Both event positions are independently required; real browser capture has denied/timeout recovery and a freshness check. Example GPS is explicitly simulated. Crew event location belongs to the device operator, not proof for all roster members. Billing has only quantity allocations, references and status decisions, with separate client/subcontractor allocation streams and duplicate protection. No prices or uploaded documents are included. Supabase and two-way Sheets remain a future backend.

Draft guards protect modal input on close/Escape/unload. Local failures preserve inputs and previously saved state. Cross-tab writes refuse stale revisions. Dataset strategy is render-all within a 20-work-record sample cap; the earlier overview shows six records and full registers show all permitted records. Filters are transient by design in this standalone review adapter. Routes have a navigable hash; preview role is reset at reload to avoid implying a persisted authenticated session. Screen-reader statuses, app-owned errors and text-labeled states are shared. Required verification: tests/browser/three-view.spec.js and current audit screenshots.

The two user-supplied screenshots are the visual source for the three-view adapter: a split login and a fixed-sidebar workspace. render()/login() share the original-image slot through brandImage(); no invented emblem is used. Settings accepts the unchanged original image into device-local state. The preview login does not send or persist credentials. Exactly three demo entry buttons and one native workspace role selector are supported. Phone layout toggles a bounded workspace preview; screens below 960px use a labeled native navigation select that delegates to go(). Bundled Source Sans 3 weights and their license are included in the standalone/PWA packages.

## Management extension of the three-view adapter

Business source: current user conversation and PRODUCT.md complete-review revision; feature traceability in docs/three-view/FEATURES.md. Canonical UI owners remain the existing three-view helpers; configurationView(), scheduleView(), reportsView() and sheetsView() extend their content rather than duplicating controls. Native date/select ownership is unchanged. Desktop and mobile worker navigation both delegate to go().

The pure workbook boundary in public/three-view/workbook.js owns CSV parsing/escaping and planning-preview validation. NPI-only import requires the current global revision and unchanged protected columns. Only unstarted title/date/equipment edits are accepted. All rows validate before save(); the preview is revalidated on commit, cross-tab revision guards still apply, and a change log records the batch. Workbook input survives in-app navigation; pending edits trigger the existing unload warning. It is a local CSV round trip, not live Google synchronization. Downloaded CSVs neutralize formula-like cells.

Plan editing uses the existing modal/validation/save owners; both admins are scoped, and attendance must not have started. Request scheduling reuses the NPI work-order form and records its linked work ID. Reports distinguish individual hours, crew totals and load counts; company scope applies to tables and exports. Workspace edits persist locally and never create managed accounts. Billing-basis metadata separates customer and subcontractor sides; subcontractors never see the customer basis. No financial amount is calculated.

Verification: tests/workbook.test.js plus tests/browser/management.spec.js cover atomic/stale/protected workbook handling, request conversion, scheduling scopes, settings, report exports, responsive/a11y behavior and phone worker navigation. The existing attendance/approval tests remain required.

## Artwork transfer and guided local test

User requested the selected logo/site pictures and one transaction for testing. Original inline assets remain inaccessible to workspace tools; web retrieval attempts are proxy-blocked. Paste/drop/file controls therefore accept the original artwork directly into the local sample without regenerating or resizing it. brandImage()/artworkSource() are canonical rendering owners; large assets use the sample-specific IndexedDB image store, while small images remain compatible with prior device data. Async generation guards prevent a closed/replaced paste operation from applying stale results. Errors preserve existing artwork and provide file-picker recovery. Startup resolves large image references before rendering. Reset clears selected large-image storage as well as local records.

Personalized export is supported by the standalone HTML. It serializes a cleared template plus only resolved logo/site artwork, stripping rendered app/dialog/status content so credentials and operational records are excluded. The hosted version gives guidance rather than exporting unresolved external scripts. Browser tests verify small/large clipboard images, unchanged byte content, reload persistence, bad clipboard recovery and export privacy.

Start test transaction creates/resumes exactly one explicitly labeled synthetic work order, within the existing cap. The user must still capture both positions, supply task/evidence and submit hours. Stage navigation switches the same three demo roles and opens the existing work/review routes; it never auto-approves a stage or moves money. See tests/browser/test-transaction.spec.js.

The review sample exposes exactly three role previews. Sample controls are optional and collapsed. Worker actions remain primary; company and NPI approvals preserve original, claimed and accepted hours. GUIDE.html provides an offline narrated walkthrough with captions and transcript.

Rate settings are NPI-only in the local preview. Source: PRODUCT.md, Rates and backend setup foundation, and user request. No seeded rates. Required scope, decimal cents, real dates and nonoverlap validate before save. Calculator does not issue invoices. Shared save() preserves revision-conflict and storage-failure recovery. Portrait dialogs retain existing scrolling and unsaved-change guard. Price-list edits do not mutate approved attendance or invoice checklists. Production tenant authorization is pending; a role preview is not access control.

Everyday Settings contains company identity, rate configuration, worker-profile navigation and attendance requirements. NPI-only Installation & support is collapsed by default and truthfully reports unconnected services; test-data maintenance is nested within it. The global local-review label remains visible. Branding prose describing the approved artwork is removed. No backend status is relabeled as connected.

Default sitePhoto() resolves a local override first, then suppliedArtwork.sites. brandImage() resolves a custom logo first, then the selected emblem region from the supplied reference. Both standalone packaging and PWA cache include bundled artwork. Source files are preserved unchanged, with hashes in docs/three-view/ARTWORK.json. Default artwork is not user-submitted work evidence and must not satisfy evidence requirements.

Shared brandImage() resolves custom artwork first, then the bundled transparent PNG. No opaque background or screenshot-crop wrapper is used for the default logo. All setup and connection state remains truthful; no deployment/connection is inferred from a custom domain name.

## Live data and permission contract

Source: PRODUCT.md Live integration candidate, setup/supabase/002-live-access.sql and supabase/functions/npi-admin/handler.js. Live field()/form()/modal()/guarded()/mutate() own native controls, error recovery, busy states, focus and versioned server writes. Native dates/selects keep OS-owned popups. The source of truth is Supabase, not browser state or Sheet cells. Auth sessions and short-lived draft recovery stay in memory; no passwords, tokens or work records are persisted in localStorage/sessionStorage. Same-user reauthentication can restore text with its original version; passwords/files/GPS must be entered again.

A browser-safe publishable key grants no work access. Users require a confirmed Auth identity and active server-owned profile. No role picker or demo fallback exists. SQL permissions are authoritative; UI checks are convenience. Original device/server times and GPS are immutable to browser clients. Company approval precedes NPI approval. Rate schedules reject overlaps, draft lines snapshot unit prices and allocations block duplicate billing on the same side. Unknown money policies remain gated as drafts. Sheet edits cannot bypass approval/version checks. Repeated command IDs reject changed payloads and reuse committed results; uploads reuse object/command identity on same-page retry.

The app bounds registers (up to 500 work items per selected workflow, with targeted detail loads); overview counts are server-scoped. Manual refresh and online recovery fetch the current server state. The PWA caches only the app shell/artwork. Offline writes are not queued. No business scope or authentication is inferred from a custom domain. Runtime setup remains a user-owned dashboard action until live acceptance is verified.

## Restored authenticated oversight shell

Visual source: user's preferred split-login/sidebar dashboard screenshots and DESIGN.md Live interface restoration. `public/live/app.js` render()/head()/panel()/summary() own the authenticated shell and overview. `public/three-view/icons.js` supplies shared decorative SVGs; native buttons/links retain accessible names. NPI verification badges use the scoped server count. The role label describes the authenticated profile and cannot change access. No prototype seed or role switch is imported.

Overview uses the server summary for total counts; hours-by-location explicitly covers loaded assignments. Empty activity preserves the dashboard composition with setup actions. Subcontractors is a real company-register route using the existing save_company action. All existing GPS, approvals, rates, uploads, spreadsheet review and account mutations retain their established service functions. Worker bottom links and administrator native page select target the same hash routes and preserve existing session/dirty-dialog guards. The frontend-only upgrade ZIP changes no SQL, Auth accounts, Apps Script or stored records. Verification: tests/browser/live.spec.js and current local captures under docs/live; these provider responses are mocks, not proof of the user's cloud installation.

## Operations 1.0 account and dispatch contract

Business source: PRODUCT.md Current release and the user's clarified company-owned workflow. Security source: 004-operations-invitations.sql. Existing live field()/form()/modal()/guarded()/operation() remain the canonical owners for validated native controls, confirmation, busy state, retry identifiers, errors and focus. Public showEnrollment() in public/live/enrollment.js owns the single registration form inside the original split-login shell. Password mismatch and malformed fields focus their error; server failure clears and remasks both password fields. No public company or role selector exists.

NPI invitation → company account → company worker invitation → pending signup → company approval → scoped company assignment → worker GPS/tasks/photos/checkout/claim → company review → NPI verification. NPI does not normally approve worker accounts; it can inspect pending state and pause approved accounts. Account decisions and work decisions remain separate. Each management mutation is versioned where necessary and idempotent by actor/request ID. Invitations are stored by hash only and bound to a fixed company/role, expiry and capacity. A registration reservation plus server-owned Auth metadata makes retries recoverable without granting incomplete identities work access. Invite revocation, expired/full links and disabled company/creator identities fail closed.

Contract/site responsibilities are set by NPI. A company can create/plan only its own work and assign active approved workers from its own company; it cannot expand its contract/site scope. The shared live action RPC retains all original GPS, evidence and company-before-NPI approval invariants. Work photos open through short-lived scoped private URLs. The hours comparison separately labels provisional elapsed time for an open check-in; recorded completed hours remain server-calculated.

The release archive has one frontend/ directory for Cloudflare, backend/ SQL/Edge/Apps Script source, START-HERE guides and verification material. It never silently imports old sample records. Migration 004 preserves existing real accounts/data. Existing installations apply only 004, update npi-admin and LiveSync, and upload frontend to the existing Pages project. Finance is deferred, not exposed as nonfunctional controls. Tests: operations-access.test.js, enrollment-api.test.js and browser/live.spec.js; browser providers are mocked and real deployment remains a separate acceptance step.

## Operations 2.0 current contract (supersedes prototype guidance)

Source authority: user-approved Operations 2.0 scope, 2026-11-19. Exactly three authenticated roles, with server company scoping. NPI can inspect assignment creator and all assigned company workers. After work starts, crew membership is immutable; administrators add additional workers through a separate assignment, preserving original attendance. Before starting, crew changes require a reason and retain history.

Evidence is stored in private Supabase Storage, with separate immutable original and stamped viewing copy. Before/after requirements are snapshotted from the service policy when work is created. Partial/unable outcomes require an explanation and explicit management review. File/camera queues stay in memory and survive upload errors while the dialog is open; there is no offline durable upload guarantee. Supported formats and caps are explicit. PDFs are timecards/documents. Malformed or unsupported images are rejected with a retained queue and actionable message.

Issue statuses: open, acknowledged, in-progress, resolved. Resolution requires a reason. Active NPI and relevant company administrators receive in-app notifications; recipient emails come from organisation-scoped settings. Emails use a service-only durable queue, provider idempotency keys and bounded retries. Sent means accepted by the provider; inbox delivery is not claimed. Secrets stay in Edge Function configuration. A scheduled dispatcher is required; no operational email is sent during local tests. Urgent escalation runs when that dispatcher runs.

Seven visible workbook tabs group records. Only existing planning/site edits are bidirectional, through the existing proposal/NPI review mechanism with expected-version checks. Attendance, evidence, account roles, issue history and approvals are protected mirrors; passwords/tokens and commands are not exported. No automatic deletion or retention purge is implemented without an approved policy. Legacy workbook tabs are hidden only through a separately labelled preserving action.

Canonical map additions: camera/file queue → public/live/photos.js; incident/notification/forms/report extensions → public/live/field.js via app.js shared owners; transactional success → FieldFeatures.success + existing modal; backend invariants → 005-field-operations.sql and existing 004 RPC; email dispatch → npi-admin handler with fixed provider endpoint and secret-bound workbook runner.

## Operations 3 — worker-led authority and behavior

Approved workers prepare visits only inside active company contract/site scope. The worker and selected approved company crew become members; no daily assignment is required. One visit can contain many contract line/sub-line entries and one original attendance timeline per worker. Snow items require an uploaded pre-start ruler photo and confirmed inches; server bands are inclusive-minimum/exclusive-maximum. Automatic reading is optional and unconfirmed until a worker confirms; manual remains available. GPS remains mandatory for actual attendance; manual site names are labels only. Drafts may be cancelled, never hard-deleted. Service descriptions and original evidence are preserved. Company review precedes NPI verification. Existing records remain supported. Canonical form/dialog validation, dirty guards, retry idempotency, session recovery and server version checks apply. Visit context is bounded to 10,000 line rows and 500 duplicate warnings; paginated work search is authoritative for older records. An optional daily digest is queued after 7 AM Alaska time, deduped per scope/date/recipient by the existing dispatcher.

## v3.1.0 reliability and review contract

Retain the approved shell and existing form/dialog owners. public/live/recovery.js owns opt-in, project-bound remembered sessions and account-scoped IndexedDB photo queues. Device saved and server saved are distinct statuses. Shared-device logout clears pending originals only after explicit confirmation. A ruler must be a fresh app-camera before photo unique to its service; below-two-inch recordings require both review acknowledgements. New snow parents remain drafts until contiguous zero-up coverage and an open highest band are present. Partial outcomes alone never bypass evidence; explicit reasons are reported by worker. Worker-led preparation expires after 24 hours without saved activity; first server check-in fixes Alaska service date. Email summaries default off, including existing settings. Public shell updates wait for saved forms and empty device queues; private files/APIs are never cached. The changed frontend requires migration 007.
