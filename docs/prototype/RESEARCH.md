# Design grounding and research limits

Reviewed 2026-11-13. The uploaded reference is guidance only; no credentials or source were copied or published.

## Accessible source evidence

- [Frappe HR Employee Checkin schema](https://github.com/frappe/hrms/blob/develop/hrms/hr/doctype/employee_checkin/employee_checkin.json): explicit employee, IN/OUT type, shift, timestamps, optional location. Design implication: worker sees one clear start action and a job-specific record; do not automatically request GPS.
- [ERPNext Maintenance Visit schema](https://github.com/frappe/erpnext/blob/develop/erpnext/maintenance/doctype/maintenance_visit/maintenance_visit.json): customer/site details, date/time, scheduled work, completion status and purposes. Design implication: location, work description, tasks and completion status belong together, with partial work visible.
- [Supabase official RLS guide source](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx): policies apply row scope and combine with grants; service-role access bypasses RLS and belongs on the server. Design implication: roles are a server boundary; Settings must not suggest that a frontend role switch or spreadsheet row grants access.

These source files were fetched and read in this run. They are evidence of common workflow patterns, not usability studies, complete app audits, or NPI policy.

## Blocked research

Direct requests to Jobber job-tracking, ClockShark, SafetyCulture inspection, Supabase documentation web pages and NPS Alaska returned proxy 403 errors. No current competitor UI audit or comparative superiority is claimed. GitHub-hosted official source was used as a bounded fallback.

## Site photos

The user provided four inline photos and confirmed Boney Courthouse, Anchorage Youth Court, Snowden Courthouse and Nesbit Courthouse. Those inline originals are visible in the conversation but not available as downloadable workspace files. The source sample therefore uses one generated Alaska landscape, prominently described as illustrative rather than a real property photo. No building likeness was invented or attributed to a real site. Original site photo embedding is pending original file availability. User can review names and tasks separately from imagery.

## Design decisions

Large worker actions, plain task labels, text with every status, evidence before review, separate supervisor decisions, one shared office/field record, explicit local/offline state, and a two-way spreadsheet conflict queue. Navy/silver/gold preserves the chosen NPI identity. Finance is deferred so this review stays about Phase 1 work tracking and account setup.
