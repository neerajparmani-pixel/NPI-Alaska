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

The two user-supplied screenshots are the visual source for the three-view adapter: a split login and a fixed-sidebar workspace. render()/login() share the original-image slot through brandImage(); no invented emblem is used. Settings accepts the unchanged original image into device-local state. The preview login does not send or persist credentials. Exactly three demo entry buttons and one native workspace role selector are supported. Phone layout toggles a bounded workspace preview; small screens use horizontally scrollable navigation. Bundled heading font and its license are included in the standalone/PWA packages.
