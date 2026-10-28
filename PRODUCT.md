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
