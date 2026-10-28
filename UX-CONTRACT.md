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
