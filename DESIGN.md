---
version: alpha
name: NPI Alaska Fieldwork
description: A legible field-work checklist inspired by Alaska dispatch boards and equipment markings.
colors:
  primary: "#102c50"
  ink: "#182b40"
  muted: "#52657a"
  accent: "#185adb"
  gold: "#cfab55"
  silver: "#cbd5e1"
  background: "#f3f6fa"
  border: "#d9e2ec"
  surface: "#ffffff"
  success: "#246248"
  danger: "#a42e35"
typography:
  sans:
    fontFamily: "Segoe UI, Arial, sans-serif"
  display:
    fontFamily: "Arial Narrow, Segoe UI, sans-serif"
rounded:
  DEFAULT: "16px"
  button: "9px"
spacing:
  page-max: "1390px"
  section-gap: "24px"
components:
  button:
    height: "54px"
  card:
    rounded: "16px"
---

# NPI Alaska Design System

## Overview

Product interface for outdoor field crews and office reviewers in Alaska. The north star is a dispatch board: obvious assignment, clear status, one next action. Approved identity: silver winged-lion emblem, deep navy wings and gold stars (user selection, 2026-10-27). Signature: navy structure, silver borders, restrained gold navigation accents and blue worker actions. The original file is pending, so a temporary NPI wordmark is used rather than an invented replacement. Avoid marketing heroes, ornamental charts, tiny text for worker actions and financial features in Phase 1.
English is the initial language; additional worker languages need confirmation. No Japan-market scope. Phone-first worker interface, wider review/management layouts. One light theme.
Runtime canonical tokens are `src/styles.css :root`. Frontmatter mirrors these values; update both together. `--navy` maps primary, `--ink` ink, `--muted` muted, `--blue` accent, `--gold` gold and `--silver` silver, `--paper` background, `--line` border, `--white` surface, `--green` success, `--red` danger, `--radius` DEFAULT radius. There are no generated adapters.

## Colors

Navy establishes structure. Strong blue with white labels marks the worker's primary next step. Gold is limited to small brand accents and selection indicators. Green communicates approval; red communicates corrections/errors. Every status has a text label. White panels on cold gray backgrounds; focus outline uses blue. Forced-colors mode retains native contrast and borders.

## Typography

System fonts avoid network downloads and layout shifts. Display headings use a narrow system stack with generous size. Body text uses Segoe UI/Arial with 1.6 line height. Critical worker controls are at least 15px on phones. IDs and hour totals use tabular numerals.

## Layout

Desktop sidebar is 240px; content max width 1390px. At 1100px it narrows to 200px. At 760px navigation becomes a top strip, cards become one column, and summaries move above forms. Natural page scrolling; no clipped form panels. Four summary cells become two columns on phones.

## Elevation & Depth

Panels use one-pixel borders, not heavy shadows. Status notification has a restrained shadow. No hover animation required.

## Shapes

16px panel corners, 9px buttons. Primary actions fill the worker card width. Field task checkboxes have generous label-sized targets.

## Components

Native buttons, labels, select controls and checkboxes preserve familiar phone behavior. Icons supplement text and never replace essential action names. No modal flows. Button styles are brand navy, blue worker primary, outline secondary and green approval. Global scrollbars remain visible.

## Do's and Don'ts

Use short action labels, explicit saved-on-device feedback, and actionable errors. Do not describe a locally saved demo photo as uploaded. Never use the demo role selector as live authorization. Respect reduced motion. Do not introduce unrelated finance UI.

## Approved brand application

Full emblem belongs on login; compact, uncropped emblem in headers. `brandMark()` in src/branding.js owns both variants and the temporary wordmark fallback. scripts/build.mjs detects public/npi-emblem.png/.jpg/.webp and injects the public logo URL. No image regeneration or unapproved simplification. Passwords remain masked, and company login has no role selector.

## Spreadsheet review surface

The user requested a spreadsheet-first review before Cloudflare. `spreadsheet-first/Index.html` mirrors the established navy, blue, gold, white and gray palette in one self-contained HTML file for copy/paste into Apps Script. This is a deliberate isolated-delivery adapter, not a new app-wide token owner. Native controls, large labeled actions, visible test banner and owner-only preview labels take precedence over decorative branding. The full original logo remains pending; no replacement emblem is invented.

## Full-page owner preview revision

The user rejected the small dialog/plain backend and provided a private NPI reference app. spreadsheet-first/Index.html now has a 224px navy navigation column, white top bar, responsive worker cards, real overview totals and a dedicated Settings surface. At 700px the navigation becomes four labeled touch buttons. Gold is limited to selection and wordmark accents; primary actions remain blue. UTF-8 charset is declared to preserve punctuation. Workspace labels are separate from the fixed NPI brand. No artwork/credentials from the uploaded reference are included; its organization is referenced in docs/REFERENCE-SETTINGS.md.

## Supabase + Sheets clickable proposal

Separate `/sample/` prototype reuses navy #102c50, blue #185adb, gold #cfab55, ice #f3f6fa and white from the established palette. `public/sample/index.html` has the isolated distribution adapter for these tokens, with system body and narrow display type. Its signature is a compact Alaska landscape dispatch strip and legible crew board: photos provide site context, not ornamental hero copy. Worker action buttons are at least 54px, mobile bottom navigation has labels, and office screens have a permanent desktop sidebar. All demo credentials/account actions are labeled simulated. Original logo pending; use the established temporary NPI wordmark. English, Alaska work timezone, no Japan scope. Natural page scrolling, native controls, app-owned dialog focus and dirty-state guard. No production visual/permission claim.

## Subcontract operations surface

`public/operations/index.html` is another isolated delivery adapter of the established navy/blue/silver/gold tokens. Its core is a three-column comparison: original recorded hours, subcontractor claim, NPI acceptance. Financial screens separate the customer and contractor sides. No generic landscape is presented as an actual courthouse photo: each site has a distinct photo slot and a local picker pending original files. Shared field/button/table/dialog helpers live in operations.js and pure calculation/review gates in domain.js. Tables have keyboard-focusable scroll regions for phone widths. The worker's required-location attendance action sits above supporting totals. The original sample remains intact.

## Three-view sample direction

The user subsequently requested a professional redesign rather than strict screenshot copying. Preserve the navy/silver/gold identity, three roles and operational information order. The signature is the gold-edged navy verification summary, with restrained surrounding panels. This adapter uses bundled Source Sans 3 at 400/600/700 for consistent offline rendering: 16px body at 1.5 line height; 32px desktop page headings, 27px phone headings, 21/20px panel headings, 14px table text, 13px supporting data. No condensed display font. Runtime owners: public/three-view/style.css :root --font-ui, --heading-size, --panel-heading, --sidebar-width, --page-padding, --radius. The established palette remains the baseline; this adapter uses blue #2459a0 for calmer primary actions.

Desktop sidebar is 232px (216px under 1200px); main padding is 32px (24px under 1200px, 16px on phones). Below 960px, a labeled native navigation select replaces the sidebar instead of horizontally scrolling links. At 640px and below, page content stacks, metrics retain two columns, forms use 16px inputs, and the brand panel becomes a compact welcome header. Buttons remain at least 44px; worker primary actions retain 54px. Phone demo preview is available on larger screens. Original emblem bytes remain pending; a small NPI placeholder is used rather than a giant empty logo panel or invented lion. Settings accepts the original unchanged. No contracts, prices or fabricated courthouse photographs are included.

## Complete operations review revision

The selected emblem remains the silver lion with navy wings and gold stars; that choice is confirmed. Only the original downloadable image bytes are missing, so do not substitute the different reference-ZIP logo or redraw the animal. brandImage() is the canonical image owner for login, sidebar and settings. It preserves the original aspect ratio and device-local selection. The settings panel describes the approved artwork explicitly.

Keep the current Source Sans 3 type scale and navy/gold structure. Extend the existing sample in place: date-grouped dispatch, per-worker/location reporting, local workbook review, service-request scheduling and workspace settings use the same head()/panel()/table()/field()/modal()/save()/go() owners. Native controls remain platform-owned. Desktop retains one sidebar; phone workers get four labeled bottom-navigation actions while administrators use the page selector. Original attendance is the visual anchor for approvals; management convenience must not obscure the recorded/claimed/accepted distinction. Tables scroll inside their own regions. No invented site photos, imported contract text or actual prices.

## Guided test and image transfer

Use the existing navy/blue outlined/primary action system for Start test transaction, the three-stage test bar and image-paste controls. A visible dashed paste region accepts keyboard paste, drag/drop and file selection. It preserves the approved emblem and each actual building photo without generating substitutes. Supplied bytes remain device-local; the optional standalone personalized export includes artwork only. The test bar is compact and wraps at phone widths; it supplements rather than replaces the original attendance/review UI. Operational records and real finance remain separate from the walkthrough.

Simplified sample: the welcome screen starts one test transaction without a nonfunctional password form. Testing controls are collapsed below the work content. Worker attendance actions and compact hour totals precede the audit trail; admin queues compare recorded, claimed and differing hours. Feedback occupies normal document flow rather than covering controls.

Rates use existing configuration panels, shared field/validation/dialog/table/save owners and native date/select controls. Customer charges and subcontractor costs are labeled explicitly; USD is adjacent to amount entry. No token or typography changes. Tables retain their canonical horizontal scroll on phones. No drift from shared styling was introduced.

Settings keeps operational configuration in primary shared panels. Installation diagnostics and reset controls are secondary native disclosures; the navy, silver and gold identity and shared field/button/table owners remain unchanged.

## Supplied site artwork

The supplied image ZIP is now accessible. Four site photos are bundled unchanged. The selected emblem appears inside the desktop reference, so brandImage() presents that region with CSS clipping; no invented replacement or generative enhancement is used. The source reference is only 1024×576 and its emblem region about 260px wide, limiting logo sharpness. Site galleries use contain framing to retain building context; worker assignment photos use a reserved 170px phone frame. Existing user-selected artwork takes precedence over bundled defaults. Shared typography and colors are unchanged.

The user requested removal of the square logo backdrop. The shared brandImage() now uses a transparent PNG prepared with the image-editing tool from the supplied reference, replacing the screenshot crop. The result is an edited derivative; original source remains preserved. No other layout/palette changes are authorized.

## Live application adapter

public/live retains the approved navy/blue/silver/gold palette, bundled Source Sans 3, selected transparent emblem, supplied site photos, split welcome/login and desktop-sidebar/mobile-select workspace. public/three-view/style.css remains the token/visual owner. public/live/style.css supplies only live forms, feedback and print variants. Functional helpers in live/app.js are shared within this authenticated runtime and deliberately do not reuse the prototype localStorage mutation owner. No new brand direction is introduced.

Live context: English, Alaska work timezone, exactly three roles. The UI shows a Supabase connection only after an authenticated database snapshot, never from presence of a key or sample state. The install ZIP excludes the prototype runtime. The old reference remains in the repository for regression and is not silently migrated.

## Live interface restoration

The user rejected the reduced live workspace and asked to restore the approved oversight interface. Preserve the existing three-view tokens (Source Sans 3, 32/27px page headings, 232/216px desktop sidebar, 32/24/16px page padding) and navy/silver/blue/gold palette. The live adapter now restores the gold-edged navy verification strip, four operational metrics, worker activity, hours by location, attention queue and approval handoff. Sidebar artwork uses a centered 104px uncropped transparent emblem; compact 28px header artwork accompanies the workspace breadcrumb. `public/three-view/icons.js` is the shared icon owner for both runtimes.

Server-scoped work counts drive the overview; loaded assignment hours are labeled as such rather than represented as all-time totals. Empty production workspaces show setup guidance, not example workers or assignments. There is no live role picker, fake notification count or unsupported invoice issuance navigation. Existing live routes/actions retain their database and permission boundaries. Worker phones use three labeled bottom-navigation actions; administrators use the canonical native page select. `public/live/style.css` owns these authenticated layout variants and reuses the existing token values without a rebrand.

## Operations 1.0: company-owned teams

Current release authority is the user's clarified workflow: NPI invites subcontractor administrators; each company administers its own workers and assignments; NPI verifies original attendance, photos and hours. No billing/rate/invoice UI ships in this release. Preserve the approved shell, transparent emblem, supplied building photos, Source Sans 3 and navy/gold overview exactly; no rebrand or new layout direction. Registration and account-status screens reuse the existing split-login shell, native labeled fields, common buttons and inline errors. Company/role come from the invitation, never dropdowns on public signup. Contract/site and invitation management extend the existing field/form/dialog owners.

The stable public invitation route is /live/#join=<token>; opening it replaces the current fragment with #register. Signup credentials/tokens remain in memory, not browser storage. Management lists show truthful pending/approved/paused status. NPI sees pending workers but the company approves registrations. Hour comparisons retain original/claimed/accepted columns; an open shift adds an explicitly provisional elapsed-at-refresh label. Work photo inspection uses a short-lived private image URL and the same dialog owner.

## Operations 2.0 evidence and incident extension

Preserve the approved Operations 1.0 shell and all Source Sans 3/navy/gold tokens. New shared owners: live/field.js extends the existing head/panel/field/form/modal/table/button helpers for incident workflows, recipients, history, filters and grouped private evidence. live/photos.js owns one camera/file queue, preview conversions and upload recovery. Routine acknowledged saves use one live-region toast; work submissions, approval decisions and incident creation use the existing app dialog with a Done action. No success claim precedes server acknowledgement. No billing/rate screens.

Camera capture is explicitly permission-triggered and supports repeated capture/keep/retake. File upload previews state device preparation time, not an unverifiable original capture date. Originals remain unchanged. Camera and object URLs are disposed when the dialog closes. Native worker navigation now has four labelled actions; Alerts opens the same shared notification page. Search filters are committed in the work hash query, while server pagination uses 50 records per page. Reports explicitly describe their loaded-record scope.

Operations 2.0 asset delivery: the live runtime uses a lossless WebP encoding of the selected transparent emblem. The original PNG is preserved. A decoded-RGBA comparison found zero differences for every visible pixel and every alpha value; only invisible RGB values can differ. Live PWA icons are resized derivatives of this same emblem, replacing the oversized source as favicon/install artwork. Shared prototype asset selection remains unchanged. No colour, shape or layout identity was changed.

## Operations 3 — worker-led visits (approved)

The existing live Source Sans 3, navy/gold layout, transparent emblem, site photos and shared field/form/dialog owners remain canonical. VisitFeatures in public/live/visits.js extends those owners; worker services use short vertical cards while administrators retain the line/sub-line table. Primary worker journey: Start work → site/service → before evidence → GPS check-in → services/photos/issues → checkout/submit. Contract codes stay in administration and stored records. No daily assignment is required. Existing assigned records retain their legacy workflow. Automatic site/photo suggestions never imply GPS attendance or confirmed snow depth. English, Alaska timezone, no Japan scope.

## v3.1.0 reliability and review contract

Retain the approved shell and existing form/dialog owners. public/live/recovery.js owns opt-in, project-bound remembered sessions and account-scoped IndexedDB photo queues. Device saved and server saved are distinct statuses. Shared-device logout clears pending originals only after explicit confirmation. A ruler must be a fresh app-camera before photo unique to its service; below-two-inch recordings require both review acknowledgements. New snow parents remain drafts until contiguous zero-up coverage and an open highest band are present. Partial outcomes alone never bypass evidence; explicit reasons are reported by worker. Worker-led preparation expires after 24 hours without saved activity; first server check-in fixes Alaska service date. Email summaries default off, including existing settings. Public shell updates wait for saved forms and empty device queues; private files/APIs are never cached. The changed frontend requires migration 007.
