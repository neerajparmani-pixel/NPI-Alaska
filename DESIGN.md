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
