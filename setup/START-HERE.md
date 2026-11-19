# NPI installation — start here

This package contains the local three-view app, blank price settings, an offline video guide, a Supabase database foundation and a Google workbook initializer. It is **not yet a connected production installation**. No accounts or cloud projects have been created by this package. Private contracts and real prices are excluded.

## 1. Review locally

Extract the ZIP. Open `START-HERE.html`. Choose NPI Admin → Settings → Location & task prices → Add rate. Add a customer charge and a separate subcontractor cost, selecting location, task, billing unit and effective dates. USD prices start blank. Use Calculate to check quantity × rate. Overlapping effective periods for the same rate scope are rejected. Fixed services use 1; visits/loads must be whole numbers. Hourly quantity can be fractional. Verify whether the contract bills worker-hours or equipment-hours.

Rates are device-local in this version; they are not secure shared account data. The public package never includes prices you enter. `Download private rates CSV` explicitly exports your local prices. Personalized picture exports omit rates and work records. Existing invoice screens still create unpriced quantity checklists; a price calculation does not issue an invoice or approve payment. Tax, equipment billing, invoice numbering/addresses, payment terms and contractual unit rules require confirmation before priced invoicing goes live.

## 2. Create your Supabase project

1. Sign in at https://supabase.com/ and create a project owned by NPI. Select the region according to company requirements. Keep the database password private.
2. Open SQL Editor and run `setup/supabase/001-foundation.sql` once, in a new empty project.
3. Confirm the `npi_` tables exist. The migration enables RLS and deliberately grants no browser access yet. It does **not** create user accounts or wire the frontend to Supabase.
4. Configure managed authentication and a server-owned username-to-identity mapping. Do not store worker passwords in Sheets, localStorage or public code. Create the NPI owner through the verified admin flow before enabling account access.
5. Next integration work: authenticated API, tested tenant/RLS policies, individual/crew attendance and immutable GPS events, two-stage approvals, private evidence storage, invoice snapshots/idempotency and a versioned spreadsheet bridge. The current local role picker must not be used as production authorization.

Do not expose a service-role key in the app or spreadsheet. Browser-safe project URL/key alone do not connect the existing local app.

## 3. Create the management spreadsheet

1. In NPI's Google account, create a blank Google Sheet. Share only with approved management.
2. Extensions → Apps Script. Replace Code.gs with `setup/google-sheets/Code.gs`.
3. Save and run `setupNpiWorkbook`. Google will ask the signed-in owner to authorize spreadsheet access.
4. Return to Sheets. It contains a Guide tab and readable tables for sites, tasks, rates, work, attendance, approvals, bills, invoices and sync review.

The initializer is owner-only and preserves existing tables. It is **not a web app or sync service**. Do not deploy it publicly. No Supabase secret is required. The initial rows are blank, except Guide. The workbook includes separate Customer_Rates and Subcontractor_Rates tabs. Keep customer rates in the management workbook; never share the whole workbook with subcontractors or workers.

## 4. How app and spreadsheet relate

They represent the same business records after the bridge is implemented; they do not look the same. The app provides role-specific screens, GPS capture, photos and approvals. The workbook provides management tables. Supabase is the authoritative database. Planning/rate edits from Sheets go to a pending-change queue with record ID, expected version and validation. They become accepted data only after server review. Attendance, original GPS, accepted decisions and issued invoice snapshots remain protected. Conflicting changes return for review instead of overwriting each other. This bridge is not connected in this package.

## 5. Artwork

Original selected emblem and Chris's site photos are not included: inline chat previews are not downloadable workspace assets, and external image sources are blocked by the network proxy. Do not treat placeholders as verified site photos. In Settings select the original logo; under Sites choose each matching building photo. Standalone Settings → Download with my pictures embeds artwork only. Use images supplied by NPI or with verified reuse permission. Source/credit information must accompany externally sourced images.

## 6. Hosting and go-live

The PWA frontend is in `three-view/`, with its shared module in `operations/`. Upload extracted contents to an HTTPS static host after review. Hosting alone does not connect accounts or either backend. Do not use this local package for live payroll, invoice issuance or multi-user operations. Retain the offline guide as a sample walkthrough; its original footage predates price settings.

Go-live requires actual account configuration and integration testing. The company approval → NPI verification workflow, denied-GPS handling, cross-company isolation, rate effective dates, invoice line snapshots, tax/rounding decisions and spreadsheet conflict handling must be tested against the real services first.
