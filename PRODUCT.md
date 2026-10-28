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
