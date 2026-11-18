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
